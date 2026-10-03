import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import { sanitizeAgencyEventPayload } from "@/lib/agency-policy";
import {
  generateQuoteDeliveryToken,
  isValidQuoteDeliveryToken,
  quoteDeliveryTokenDigest,
} from "@/lib/quote-delivery-token";

export type QuoteDeliveryActor = {
  workspaceId: number;
  accountId: number;
};

type Json = Record<string, unknown>;
type Result = { status: number; body: Json };

const activeOpportunityStages = new Set(["new", "qualified", "sourcing", "quoted", "negotiating"]);
const terminalQuoteStatuses = new Set(["accepted", "declined", "expired", "superseded"]);

function ok(body: Json, status = 200): Result {
  return { status, body };
}

function fail(error: string, status: number): Result {
  return { status, body: { error } };
}

function positiveId(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isSafeInteger(parsed) && Number(parsed) > 0 ? Number(parsed) : null;
}

async function appendEvent(
  client: PoolClient,
  actor: QuoteDeliveryActor,
  input: { eventType: string; referenceId: number; payload: Json },
) {
  await client.query(
    `INSERT INTO agency_domain_events
      (workspace_id, actor_account_id, event_type, payload, reference_type, reference_id, correlation_id)
     VALUES ($1,$2,$3,$4::jsonb,'quote_delivery',$5,$6)`,
    [
      actor.workspaceId,
      actor.accountId,
      input.eventType,
      JSON.stringify(sanitizeAgencyEventPayload(input.payload)),
      input.referenceId,
      randomUUID(),
    ],
  );
}

async function loadCanonicalQuoteVersion(
  client: PoolClient,
  actor: QuoteDeliveryActor,
  quoteId: number,
  quoteVersionId: number,
  lock = false,
) {
  const result = await client.query(
    `SELECT qv.id, qv.opportunity_id, qv.version, qv.valid_until,
            q.status AS quote_status, o.stage AS opportunity_stage,
            EXISTS (
              SELECT 1 FROM agency_quote_versions newer
               WHERE newer.workspace_id = qv.workspace_id
                 AND newer.quote_id = qv.quote_id
                 AND newer.version > qv.version
            ) AS has_newer_version
       FROM agency_quote_versions qv
       JOIN agency_quotes q
         ON q.id = qv.quote_id
        AND q.workspace_id = qv.workspace_id
        AND q.opportunity_id = qv.opportunity_id
       JOIN agency_opportunities o
         ON o.id = qv.opportunity_id
        AND o.workspace_id = qv.workspace_id
      WHERE qv.id = $1 AND qv.quote_id = $2 AND qv.workspace_id = $3
      LIMIT 1
      ${lock ? "FOR UPDATE OF q, o" : ""}`,
    [quoteVersionId, quoteId, actor.workspaceId],
  );
  return result.rows[0] as Record<string, unknown> | undefined;
}

function quoteStateConflict(row: Record<string, unknown>): string | null {
  if (row.has_newer_version === true) return "A newer quote version exists. Prepare the newest version instead of a stale commercial snapshot.";
  if (terminalQuoteStatuses.has(String(row.quote_status))) return "This quote is terminal and cannot be shared again.";
  if (!activeOpportunityStages.has(String(row.opportunity_stage))) return "This opportunity is terminal and cannot receive a new quote delivery.";
  if (!row.valid_until) return "Client-facing quote links require an explicit quote validity date.";
  const validUntil = new Date(String(row.valid_until));
  if (Number.isNaN(validUntil.getTime()) || validUntil.getTime() <= Date.now()) return "This quote version is expired. Create a refreshed version before sharing it.";
  return null;
}

export async function prepareQuoteDelivery(
  actor: QuoteDeliveryActor,
  input: { quoteId: unknown; quoteVersionId: unknown; channel: unknown },
): Promise<Result> {
  const quoteId = positiveId(input.quoteId);
  const quoteVersionId = positiveId(input.quoteVersionId);
  const channel = typeof input.channel === "string" && ["email", "whatsapp", "link", "manual"].includes(input.channel)
    ? input.channel
    : null;
  if (!quoteId || !quoteVersionId || !channel) return fail("quoteId, quoteVersionId, and channel are required.", 422);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = await loadCanonicalQuoteVersion(client, actor, quoteId, quoteVersionId, true);
    const opportunityId = positiveId(row?.opportunity_id);
    if (!row || !opportunityId) {
      await client.query("ROLLBACK");
      return fail("Quote version not found in this workspace.", 404);
    }
    const conflict = quoteStateConflict(row);
    if (conflict) {
      await client.query("ROLLBACK");
      return fail(conflict, 409);
    }

    // Only the newest prepared link is useful before communication. Revoking older
    // unshared links keeps accidental token copies from becoming future ambiguity.
    await client.query(
      `UPDATE agency_quote_deliveries
          SET status = 'revoked', updated_at = NOW()
        WHERE workspace_id = $1 AND quote_id = $2 AND quote_version_id = $3 AND status = 'prepared'`,
      [actor.workspaceId, quoteId, quoteVersionId],
    );

    const token = generateQuoteDeliveryToken();
    const tokenDigest = quoteDeliveryTokenDigest(token);
    const inserted = await client.query(
      `INSERT INTO agency_quote_deliveries
        (workspace_id, opportunity_id, quote_id, quote_version_id, token_digest, channel,
         status, expires_at, created_by_account_id)
       VALUES ($1,$2,$3,$4,$5,$6,'prepared',$7,$8)
       RETURNING id, expires_at AS "expiresAt"`,
      [actor.workspaceId, opportunityId, quoteId, quoteVersionId, tokenDigest, channel, new Date(String(row.valid_until)).toISOString(), actor.accountId],
    );
    const deliveryId = positiveId(inserted.rows[0]?.id);
    if (!deliveryId) throw new Error("Quote delivery insert did not return an id.");

    await appendEvent(client, actor, {
      eventType: "quote.delivery_prepared",
      referenceId: deliveryId,
      payload: { opportunityId, quoteId, quoteVersionId, channel },
    });
    await client.query("COMMIT");
    return ok({
      deliveryId,
      quoteId,
      quoteVersionId,
      state: "prepared",
      sharePath: `/q/${token}`,
      activationToken: token,
      expiresAt: new Date(inserted.rows[0].expiresAt).toISOString(),
    }, 201);
  } catch (error) {
    await client.query("ROLLBACK");
    const code = (error as { code?: string }).code;
    if (code === "23514" || code === "23505") return fail("The prepared quote link conflicts with current commercial state. Refresh and use the latest valid quote version.", 409);
    console.error("Quote delivery preparation failed", error);
    return fail("Quote link could not be prepared safely.", 500);
  } finally {
    client.release();
  }
}

export async function activateQuoteDelivery(
  actor: QuoteDeliveryActor,
  input: { token: unknown },
): Promise<Result> {
  const token = typeof input.token === "string" ? input.token : "";
  if (!isValidQuoteDeliveryToken(token)) return fail("Prepared quote token is invalid.", 422);
  const tokenDigest = quoteDeliveryTokenDigest(token);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT expire_quote_delivery_on_access($1)`, [tokenDigest]);
    const deliveryResult = await client.query(
      `SELECT d.id, d.opportunity_id, d.quote_id, d.quote_version_id, d.channel, d.status, d.expires_at
         FROM agency_quote_deliveries d
        WHERE d.workspace_id = $1 AND d.token_digest = $2
        LIMIT 1
        FOR UPDATE`,
      [actor.workspaceId, tokenDigest],
    );
    const delivery = deliveryResult.rows[0] as Record<string, unknown> | undefined;
    if (!delivery) {
      await client.query("ROLLBACK");
      return fail("Prepared quote link was not found in this workspace.", 404);
    }
    if (delivery.status !== "prepared") {
      await client.query("ROLLBACK");
      return fail(delivery.status === "active" ? "This quote link is already marked as shared." : "This prepared quote link is no longer activatable.", 409);
    }

    const deliveryId = positiveId(delivery.id)!;
    const opportunityId = positiveId(delivery.opportunity_id)!;
    const quoteId = positiveId(delivery.quote_id)!;
    const quoteVersionId = positiveId(delivery.quote_version_id)!;
    const row = await loadCanonicalQuoteVersion(client, actor, quoteId, quoteVersionId, true);
    if (!row || positiveId(row.opportunity_id) !== opportunityId) {
      await client.query("ROLLBACK");
      return fail("Prepared quote linkage is no longer valid.", 409);
    }
    const conflict = quoteStateConflict(row);
    if (conflict) {
      await client.query("ROLLBACK");
      return fail(conflict, 409);
    }

    await client.query(
      `INSERT INTO agency_commercial_activities
        (workspace_id, opportunity_id, quote_id, quote_version_id, activity_type, actor_account_id, channel, metadata)
       VALUES ($1,$2,$3,$4,'quote_sent',$5,$6,$7::jsonb)`,
      [actor.workspaceId, opportunityId, quoteId, quoteVersionId, actor.accountId, delivery.channel, JSON.stringify({ deliveryId })],
    );
    await client.query(
      `UPDATE agency_quote_deliveries SET status = 'active', updated_at = NOW() WHERE id = $1`,
      [deliveryId],
    );
    await client.query(
      `UPDATE agency_quotes SET status = 'sent', updated_at = NOW() WHERE id = $1 AND workspace_id = $2`,
      [quoteId, actor.workspaceId],
    );
    await client.query(
      `UPDATE agency_opportunities SET stage = 'quoted', updated_at = NOW()
        WHERE id = $1 AND workspace_id = $2 AND stage NOT IN ('won','lost','cancelled')`,
      [opportunityId, actor.workspaceId],
    );
    await appendEvent(client, actor, {
      eventType: "quote.delivery_activated",
      referenceId: deliveryId,
      payload: { opportunityId, quoteId, quoteVersionId, channel: delivery.channel },
    });
    await client.query("COMMIT");
    return ok({
      deliveryId,
      quoteId,
      quoteVersionId,
      state: "active",
      sharePath: `/q/${token}`,
      expiresAt: new Date(String(delivery.expires_at)).toISOString(),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    const code = (error as { code?: string }).code;
    if (code === "23514" || code === "23505") return fail("The quote changed before activation. Refresh and prepare the latest valid version.", 409);
    console.error("Quote delivery activation failed", error);
    return fail("Quote link could not be activated safely.", 500);
  } finally {
    client.release();
  }
}

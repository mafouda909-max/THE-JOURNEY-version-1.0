import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import { sanitizeAgencyEventPayload } from "@/lib/agency-policy";
import { isValidQuoteDeliveryToken, quoteDeliveryTokenDigest } from "@/lib/quote-delivery-token";

export type QuoteDeliveryResponse = "approved" | "declined" | "changes_requested";

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

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned && cleaned.length <= max ? cleaned : null;
}

function publicQuoteLine(value: unknown): Json | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const line = value as Json;
  const label = typeof line.label === "string" ? line.label : null;
  const kind = typeof line.kind === "string" ? line.kind : null;
  const currency = typeof line.currency === "string" ? line.currency : null;
  const quantity = Number(line.quantity);
  const sellUnitMinor = Number(line.sellUnitMinor);
  if (!label || !kind || !currency || !Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isSafeInteger(sellUnitMinor) || sellUnitMinor < 0) {
    return null;
  }
  const lineTotalMinor = quantity * sellUnitMinor;
  if (!Number.isSafeInteger(lineTotalMinor)) return null;
  return { kind, label, quantity, currency, sellUnitMinor, lineTotalMinor };
}

async function appendPublicEvent(
  client: PoolClient,
  input: { workspaceId: number; eventType: string; referenceId: number; payload: Json },
) {
  await client.query(
    `INSERT INTO agency_domain_events
      (workspace_id, actor_account_id, event_type, payload, reference_type, reference_id, correlation_id)
     VALUES ($1,NULL,$2,$3::jsonb,'quote_delivery',$4,$5)`,
    [
      input.workspaceId,
      input.eventType,
      JSON.stringify(sanitizeAgencyEventPayload(input.payload)),
      input.referenceId,
      randomUUID(),
    ],
  );
}

export async function getPublicQuoteDelivery(token: string): Promise<Result> {
  if (!isValidQuoteDeliveryToken(token)) return fail("Quote link is invalid.", 404);
  const tokenDigest = quoteDeliveryTokenDigest(token);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT expire_quote_delivery_on_access($1)`, [tokenDigest]);
    const result = await client.query(
      `SELECT d.id, d.status, d.expires_at, d.response, d.responded_at,
              w.name AS workspace_name,
              qv.version, qv.currency, qv.sell_total_minor, qv.lines_snapshot,
              qv.client_facing_terms, qv.valid_until, iv.intent_snapshot
         FROM agency_quote_deliveries d
         JOIN agency_workspaces w ON w.id = d.workspace_id
         JOIN agency_quote_versions qv
           ON qv.id = d.quote_version_id
          AND qv.workspace_id = d.workspace_id
          AND qv.opportunity_id = d.opportunity_id
         JOIN agency_intent_versions iv
           ON iv.id = qv.intent_version_id
          AND iv.workspace_id = qv.workspace_id
          AND iv.opportunity_id = qv.opportunity_id
        WHERE d.token_digest = $1
        LIMIT 1`,
      [tokenDigest],
    );
    await client.query("COMMIT");
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return fail("Quote link is invalid.", 404);
    if (row.status === "prepared") return fail("This quote link has not been marked as shared yet.", 404);
    if (row.status === "revoked" || row.status === "expired") return fail("This quote link is no longer active.", 410);
    if (new Date(String(row.expires_at)).getTime() <= Date.now()) return fail("This quote link has expired.", 410);

    const intent = row.intent_snapshot && typeof row.intent_snapshot === "object" && !Array.isArray(row.intent_snapshot)
      ? row.intent_snapshot as Json
      : {};
    const travelers = intent.travelers && typeof intent.travelers === "object" && !Array.isArray(intent.travelers)
      ? intent.travelers as Json
      : {};
    const rawLines = Array.isArray(row.lines_snapshot) ? row.lines_snapshot : [];
    const lines = rawLines.map(publicQuoteLine).filter((line): line is Json => line !== null);
    return ok({
      status: row.status,
      response: row.response ?? null,
      respondedAt: row.responded_at ? new Date(String(row.responded_at)).toISOString() : null,
      agency: { name: String(row.workspace_name) },
      trip: {
        originCity: typeof intent.originCity === "string" ? intent.originCity : null,
        destinations: Array.isArray(intent.destinations) ? intent.destinations.filter((value): value is string => typeof value === "string") : [],
        departureDate: typeof intent.departureDate === "string" ? intent.departureDate : null,
        returnDate: typeof intent.returnDate === "string" ? intent.returnDate : null,
        travelers: {
          adults: Number(travelers.adults) || 0,
          children: Number(travelers.children) || 0,
          infants: Number(travelers.infants) || 0,
        },
      },
      quote: {
        version: Number(row.version),
        currency: String(row.currency),
        sellTotalMinor: Number(row.sell_total_minor),
        lines,
        clientFacingTerms: typeof row.client_facing_terms === "string" ? row.client_facing_terms : null,
        validUntil: new Date(String(row.valid_until)).toISOString(),
      },
      expiresAt: new Date(String(row.expires_at)).toISOString(),
    });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* transaction may already be closed */ }
    console.error("Public quote delivery read failed", error);
    return fail("Quote link could not be loaded safely.", 500);
  } finally {
    client.release();
  }
}

export async function markQuoteDeliveryViewed(token: string): Promise<Result> {
  if (!isValidQuoteDeliveryToken(token)) return fail("Quote link is invalid.", 404);
  const tokenDigest = quoteDeliveryTokenDigest(token);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT expire_quote_delivery_on_access($1)`, [tokenDigest]);
    const result = await client.query(
      `SELECT id, workspace_id, opportunity_id, quote_id, quote_version_id, status, expires_at, first_viewed_at
         FROM agency_quote_deliveries
        WHERE token_digest = $1
        LIMIT 1
        FOR UPDATE`,
      [tokenDigest],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      await client.query("ROLLBACK");
      return fail("Quote link is invalid.", 404);
    }
    if (row.status === "prepared") {
      await client.query("ROLLBACK");
      return fail("Quote link is not active.", 404);
    }
    if (row.status === "revoked" || row.status === "expired" || new Date(String(row.expires_at)).getTime() <= Date.now()) {
      await client.query("ROLLBACK");
      return fail("This quote link is no longer active.", 410);
    }

    const deliveryId = positiveId(row.id)!;
    const workspaceId = positiveId(row.workspace_id)!;
    const opportunityId = positiveId(row.opportunity_id)!;
    const quoteId = positiveId(row.quote_id)!;
    const quoteVersionId = positiveId(row.quote_version_id)!;
    const firstView = !row.first_viewed_at;
    await client.query(
      `UPDATE agency_quote_deliveries
          SET first_viewed_at = COALESCE(first_viewed_at, NOW()), last_viewed_at = NOW(), updated_at = NOW()
        WHERE id = $1`,
      [deliveryId],
    );
    if (firstView) {
      await client.query(
        `INSERT INTO agency_commercial_activities
          (workspace_id, opportunity_id, quote_id, quote_version_id, activity_type, actor_account_id, channel, metadata)
         VALUES ($1,$2,$3,$4,'quote_viewed',NULL,'link',$5::jsonb)`,
        [workspaceId, opportunityId, quoteId, quoteVersionId, JSON.stringify({ deliveryId })],
      );
      await client.query(
        `UPDATE agency_opportunities
            SET stage = CASE WHEN stage IN ('quoted','sourcing','qualified','new') THEN 'negotiating' ELSE stage END,
                updated_at = NOW()
          WHERE id = $1 AND workspace_id = $2 AND stage NOT IN ('won','lost','cancelled')`,
        [opportunityId, workspaceId],
      );
      await appendPublicEvent(client, {
        workspaceId,
        eventType: "quote.delivery_viewed",
        referenceId: deliveryId,
        payload: { quoteVersionId },
      });
    }
    await client.query("COMMIT");
    return ok({ viewed: true, firstView });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Quote delivery view tracking failed", error);
    return fail("Quote view could not be recorded safely.", 500);
  } finally {
    client.release();
  }
}

export async function respondToQuoteDelivery(
  token: string,
  input: { response: unknown; message?: unknown },
): Promise<Result> {
  if (!isValidQuoteDeliveryToken(token)) return fail("Quote link is invalid.", 404);
  const response = typeof input.response === "string" && ["approved", "declined", "changes_requested"].includes(input.response)
    ? input.response as QuoteDeliveryResponse
    : null;
  if (!response) return fail("Client response is invalid.", 422);
  const message = input.message == null || input.message === "" ? null : text(input.message, 1000);
  if (input.message != null && input.message !== "" && !message) return fail("Client message is too long or invalid.", 422);

  const tokenDigest = quoteDeliveryTokenDigest(token);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT expire_quote_delivery_on_access($1)`, [tokenDigest]);
    const result = await client.query(
      `SELECT d.id, d.workspace_id, d.opportunity_id, d.quote_id, d.quote_version_id, d.status, d.expires_at,
              o.stage AS opportunity_stage, q.status AS quote_status
         FROM agency_quote_deliveries d
         JOIN agency_opportunities o ON o.id = d.opportunity_id AND o.workspace_id = d.workspace_id
         JOIN agency_quotes q ON q.id = d.quote_id AND q.workspace_id = d.workspace_id
        WHERE d.token_digest = $1
        LIMIT 1
        FOR UPDATE OF d, o, q`,
      [tokenDigest],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      await client.query("ROLLBACK");
      return fail("Quote link is invalid.", 404);
    }
    if (row.status !== "active") {
      await client.query("ROLLBACK");
      return fail(row.status === "responded" ? "A response has already been recorded for this quote link." : "This quote link is no longer active.", 409);
    }
    if (new Date(String(row.expires_at)).getTime() <= Date.now()) {
      await client.query("ROLLBACK");
      return fail("This quote link has expired.", 410);
    }
    if (!activeOpportunityStages.has(String(row.opportunity_stage)) || terminalQuoteStatuses.has(String(row.quote_status))) {
      await client.query("ROLLBACK");
      return fail("This quote can no longer receive a client response.", 409);
    }

    const deliveryId = positiveId(row.id)!;
    const workspaceId = positiveId(row.workspace_id)!;
    const opportunityId = positiveId(row.opportunity_id)!;
    const quoteId = positiveId(row.quote_id)!;
    const quoteVersionId = positiveId(row.quote_version_id)!;
    await client.query(
      `UPDATE agency_quote_deliveries
          SET status = 'responded', response = $1, response_message = $2, responded_at = NOW(), updated_at = NOW()
        WHERE id = $3`,
      [response, message, deliveryId],
    );
    await client.query(
      `INSERT INTO agency_commercial_activities
        (workspace_id, opportunity_id, quote_id, quote_version_id, activity_type, actor_account_id, channel, metadata)
       VALUES ($1,$2,$3,$4,'client_response',NULL,'link',$5::jsonb)`,
      [workspaceId, opportunityId, quoteId, quoteVersionId, JSON.stringify({ deliveryId, response, ...(message ? { message } : {}) })],
    );
    await client.query(
      `UPDATE agency_opportunities
          SET stage = CASE WHEN stage IN ('quoted','sourcing','qualified','new') THEN 'negotiating' ELSE stage END,
              updated_at = NOW()
        WHERE id = $1 AND workspace_id = $2 AND stage NOT IN ('won','lost','cancelled')`,
      [opportunityId, workspaceId],
    );

    const signal = response === "approved"
      ? {
          kind: "client_approved",
          severity: "high",
          explanation: "The traveler approved the shared quote version.",
          action: "Confirm supplier availability and payment/booking facts before recording the opportunity as won.",
        }
      : response === "changes_requested"
        ? {
            kind: "client_changes_requested",
            severity: "attention",
            explanation: "The traveler requested changes to the shared quote version.",
            action: "Capture the changed intent, refresh supplier evidence, and create a new quote version.",
          }
        : {
            kind: "client_declined",
            severity: "attention",
            explanation: "The traveler declined the shared quote version.",
            action: "Confirm whether another option is viable; record a structured loss only if the opportunity is actually closed.",
          };
    await client.query(
      `INSERT INTO agency_intelligence_signals
        (workspace_id, opportunity_id, quote_version_id, signal_kind, severity, score, explanation, recommended_action, evidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [workspaceId, opportunityId, quoteVersionId, signal.kind, signal.severity, 1, signal.explanation, signal.action, JSON.stringify({ deliveryId, response })],
    );
    await appendPublicEvent(client, {
      workspaceId,
      eventType: "quote.client_response_recorded",
      referenceId: deliveryId,
      payload: { quoteVersionId, response, messageCaptured: Boolean(message) },
    });
    await client.query("COMMIT");
    return ok({ response, recorded: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Quote client response failed", error);
    return fail("Client response could not be recorded safely.", 500);
  } finally {
    client.release();
  }
}

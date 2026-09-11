import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { pool } from "@/db";
import { getAgencyWorkspaceAccess } from "@/lib/agency-access";
import { sanitizeAgencyEventPayload } from "@/lib/agency-policy";
import {
  buildMarketplaceProjection,
  calculateQuoteEconomics,
  deriveCommercialSignals,
  parseQuoteLines,
  parseTravelerIntent,
  quoteVersionDigest,
  type OpportunitySource,
  type OpportunityStage,
  type QuoteEconomics,
  type TravelerIntent,
} from "@/lib/commercial-domain";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
type Json = Record<string, unknown>;

function positiveId(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isInteger(parsed) && Number(parsed) > 0 ? Number(parsed) : null;
}

function text(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned && cleaned.length <= max ? cleaned : null;
}

function nullableText(value: unknown, max = 4000): string | null {
  if (value == null || value === "") return null;
  return text(value, max);
}

function email(value: unknown): string | null {
  const cleaned = text(value, 320)?.toLowerCase() ?? null;
  return cleaned && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) ? cleaned : null;
}

function isoTimestamp(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

async function parseBody(request: Request): Promise<Json | null> {
  try {
    const value: unknown = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Json : null;
  } catch {
    return null;
  }
}

async function appendDomainEvent(
  client: Awaited<ReturnType<typeof pool.connect>>,
  input: {
    workspaceId: number;
    actorAccountId: number;
    eventType: string;
    referenceType: string;
    referenceId: number;
    payload: Record<string, unknown>;
  },
) {
  await client.query(
    `INSERT INTO agency_domain_events
      (workspace_id, actor_account_id, event_type, payload, reference_type, reference_id, correlation_id)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
    [
      input.workspaceId,
      input.actorAccountId,
      input.eventType,
      JSON.stringify(sanitizeAgencyEventPayload(input.payload)),
      input.referenceType,
      input.referenceId,
      randomUUID(),
    ],
  );
}

async function loadOpportunity(client: Awaited<ReturnType<typeof pool.connect>>, workspaceId: number, opportunityId: number) {
  const result = await client.query(
    `SELECT o.*, c.display_name AS client_display_name, c.email AS client_email
       FROM agency_opportunities o
       JOIN agency_clients c ON c.id = o.client_id
      WHERE o.id = $1 AND o.workspace_id = $2
      LIMIT 1`,
    [opportunityId, workspaceId],
  );
  return result.rows[0] ?? null;
}

async function latestIntent(client: Awaited<ReturnType<typeof pool.connect>>, workspaceId: number, opportunityId: number) {
  const result = await client.query(
    `SELECT id, revision, intent_snapshot, provenance, created_at
       FROM agency_intent_versions
      WHERE workspace_id = $1 AND opportunity_id = $2
      ORDER BY revision DESC
      LIMIT 1`,
    [workspaceId, opportunityId],
  );
  return result.rows[0] ?? null;
}

async function latestQuoteVersion(client: Awaited<ReturnType<typeof pool.connect>>, workspaceId: number, opportunityId: number) {
  const result = await client.query(
    `SELECT qv.*, q.status AS quote_status
       FROM agency_quote_versions qv
       JOIN agency_quotes q ON q.id = qv.quote_id
      WHERE qv.workspace_id = $1 AND qv.opportunity_id = $2
      ORDER BY qv.created_at DESC, qv.version DESC
      LIMIT 1`,
    [workspaceId, opportunityId],
  );
  return result.rows[0] ?? null;
}

function terminal(stage: string): boolean {
  return stage === "won" || stage === "lost" || stage === "cancelled";
}

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  const workspaceId = positiveId(id);
  if (!workspaceId) return NextResponse.json({ error: "Invalid workspace id." }, { status: 400 });

  const access = await getAgencyWorkspaceAccess(request, workspaceId);
  if (access.denied) return access.denied;

  const result = await pool.query(
    `SELECT
       o.id,
       o.source,
       o.stage,
       o.title,
       o.outcome_reason AS "outcomeReason",
       o.created_at AS "createdAt",
       o.updated_at AS "updatedAt",
       o.closed_at AS "closedAt",
       c.display_name AS "clientName",
       iv.revision AS "intentRevision",
       iv.intent_snapshot AS intent,
       qv.id AS "quoteVersionId",
       qv.version AS "quoteVersion",
       qv.currency,
       qv.sell_total_minor AS "sellTotalMinor",
       qv.gross_profit_minor AS "grossProfitMinor",
       qv.margin_bps AS "marginBps",
       qv.valid_until AS "quoteValidUntil",
       activity.occurred_at AS "lastActivityAt"
     FROM agency_opportunities o
     JOIN agency_clients c ON c.id = o.client_id
     LEFT JOIN LATERAL (
       SELECT revision, intent_snapshot
       FROM agency_intent_versions
       WHERE opportunity_id = o.id
       ORDER BY revision DESC LIMIT 1
     ) iv ON TRUE
     LEFT JOIN LATERAL (
       SELECT id, version, currency, sell_total_minor, gross_profit_minor, margin_bps, valid_until
       FROM agency_quote_versions
       WHERE opportunity_id = o.id
       ORDER BY created_at DESC, version DESC LIMIT 1
     ) qv ON TRUE
     LEFT JOIN LATERAL (
       SELECT occurred_at
       FROM agency_commercial_activities
       WHERE opportunity_id = o.id
       ORDER BY occurred_at DESC LIMIT 1
     ) activity ON TRUE
     WHERE o.workspace_id = $1
     ORDER BY CASE o.stage
       WHEN 'negotiating' THEN 1 WHEN 'quoted' THEN 2 WHEN 'sourcing' THEN 3
       WHEN 'qualified' THEN 4 WHEN 'new' THEN 5 ELSE 6 END,
       o.updated_at DESC`,
    [workspaceId],
  );

  return NextResponse.json({
    workspace: { id: workspaceId, role: access.membership?.role },
    opportunities: result.rows,
  });
}

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const workspaceId = positiveId(id);
  if (!workspaceId) return NextResponse.json({ error: "Invalid workspace id." }, { status: 400 });

  const access = await getAgencyWorkspaceAccess(request, workspaceId);
  if (access.denied) return access.denied;
  if (!access.account || !access.workspace || !access.membership) {
    return NextResponse.json({ error: "Agency access unavailable." }, { status: 403 });
  }

  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  const command = text(body.command, 40);
  if (!command) return NextResponse.json({ error: "Commercial command is required." }, { status: 422 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (command === "create_opportunity") {
      const source = typeof body.source === "string" && ["marketplace", "manual", "referral", "repeat", "partner"].includes(body.source)
        ? body.source as OpportunitySource
        : null;
      if (!source) return await rollbackJson(client, { error: "Opportunity source is invalid." }, 422);

      const parsedIntent = parseTravelerIntent(body.intent);
      if (!parsedIntent.ok) return await rollbackJson(client, { error: parsedIntent.error }, 422);

      const sourceContactRequestId = body.sourceContactRequestId == null ? null : positiveId(body.sourceContactRequestId);
      if (body.sourceContactRequestId != null && !sourceContactRequestId) {
        return await rollbackJson(client, { error: "sourceContactRequestId is invalid." }, 422);
      }
      if (sourceContactRequestId && source !== "marketplace") {
        return await rollbackJson(client, { error: "Only marketplace opportunities may bind a contact request." }, 422);
      }

      let clientName: string | null = null;
      let clientEmail: string | null = null;
      let platformAccountId: number | null = null;

      if (sourceContactRequestId) {
        const contact = await client.query(
          `SELECT traveler_account_id, traveler_name, traveler_email
             FROM contact_requests
            WHERE id = $1 AND agent_id = $2
            LIMIT 1`,
          [sourceContactRequestId, access.workspace.agentId],
        );
        const row = contact.rows[0];
        if (!row) return await rollbackJson(client, { error: "Marketplace inquiry not found for this agency." }, 404);
        clientName = text(row.traveler_name, 240);
        clientEmail = email(row.traveler_email);
        platformAccountId = positiveId(row.traveler_account_id);
      } else {
        const clientInput = body.client && typeof body.client === "object" && !Array.isArray(body.client)
          ? body.client as Json
          : null;
        clientName = clientInput ? text(clientInput.displayName, 240) : null;
        clientEmail = clientInput ? email(clientInput.email) : null;
        const clientPhone = clientInput ? nullableText(clientInput.phone, 80) : null;
        if (!clientName || (!clientEmail && !clientPhone)) {
          return await rollbackJson(client, { error: "Client name plus email or phone is required." }, 422);
        }
        body.__clientPhone = clientPhone;
      }

      let agencyClientId: number | null = null;
      if (clientEmail) {
        const existing = await client.query(
          `SELECT id FROM agency_clients WHERE workspace_id = $1 AND lower(email) = lower($2) LIMIT 1`,
          [workspaceId, clientEmail],
        );
        agencyClientId = existing.rows[0]?.id ?? null;
      }
      if (!agencyClientId) {
        const insertedClient = await client.query(
          `INSERT INTO agency_clients
            (workspace_id, platform_account_id, display_name, email, phone, created_by_account_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [workspaceId, platformAccountId, clientName, clientEmail, body.__clientPhone ?? null, access.account.id],
        );
        agencyClientId = insertedClient.rows[0]!.id;
      }

      const insertedOpportunity = await client.query(
        `INSERT INTO agency_opportunities
          (workspace_id, client_id, source, source_contact_request_id, stage, assigned_account_id, title, created_by_account_id)
         VALUES ($1, $2, $3, $4, 'new', $5, $6, $5)
         RETURNING id, source, stage, title, created_at`,
        [workspaceId, agencyClientId, source, sourceContactRequestId, access.account.id, nullableText(body.title, 240)],
      );
      const opportunity = insertedOpportunity.rows[0]!;
      await client.query(
        `INSERT INTO agency_intent_versions
          (workspace_id, opportunity_id, revision, intent_snapshot, provenance, created_by_account_id)
         VALUES ($1, $2, 1, $3::jsonb, $4::jsonb, $5)`,
        [workspaceId, opportunity.id, JSON.stringify(parsedIntent.value), JSON.stringify({ source }), access.account.id],
      );
      await appendDomainEvent(client, {
        workspaceId,
        actorAccountId: access.account.id,
        eventType: "opportunity.created",
        referenceType: "opportunity",
        referenceId: opportunity.id,
        payload: { source, intentRevision: 1 },
      });

      await client.query("COMMIT");
      return NextResponse.json({ opportunity, intentRevision: 1 }, { status: 201 });
    }

    if (command === "add_intent_version") {
      const opportunityId = positiveId(body.opportunityId);
      if (!opportunityId) return await rollbackJson(client, { error: "opportunityId is required." }, 422);
      const opportunity = await loadOpportunity(client, workspaceId, opportunityId);
      if (!opportunity) return await rollbackJson(client, { error: "Opportunity not found." }, 404);
      if (terminal(opportunity.stage)) return await rollbackJson(client, { error: "Terminal opportunities cannot receive new intent versions." }, 409);
      const parsedIntent = parseTravelerIntent(body.intent);
      if (!parsedIntent.ok) return await rollbackJson(client, { error: parsedIntent.error }, 422);
      const revisionResult = await client.query(
        `SELECT COALESCE(MAX(revision), 0)::int + 1 AS revision
           FROM agency_intent_versions WHERE opportunity_id = $1`,
        [opportunityId],
      );
      const revision = Number(revisionResult.rows[0]!.revision);
      await client.query(
        `INSERT INTO agency_intent_versions
          (workspace_id, opportunity_id, revision, intent_snapshot, provenance, created_by_account_id)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
        [workspaceId, opportunityId, revision, JSON.stringify(parsedIntent.value), JSON.stringify({ source: "agent_revision" }), access.account.id],
      );
      await client.query(
        `UPDATE agency_opportunities SET stage = CASE WHEN stage = 'new' THEN 'qualified' ELSE stage END, updated_at = NOW() WHERE id = $1`,
        [opportunityId],
      );
      await appendDomainEvent(client, {
        workspaceId,
        actorAccountId: access.account.id,
        eventType: "traveler_intent.versioned",
        referenceType: "opportunity",
        referenceId: opportunityId,
        payload: { revision },
      });
      await client.query("COMMIT");
      return NextResponse.json({ opportunityId, revision }, { status: 201 });
    }

    if (command === "create_quote_version") {
      const opportunityId = positiveId(body.opportunityId);
      if (!opportunityId) return await rollbackJson(client, { error: "opportunityId is required." }, 422);
      const opportunity = await loadOpportunity(client, workspaceId, opportunityId);
      if (!opportunity) return await rollbackJson(client, { error: "Opportunity not found." }, 404);
      if (terminal(opportunity.stage)) return await rollbackJson(client, { error: "Terminal opportunities cannot receive quote versions." }, 409);

      const parsedLines = parseQuoteLines(body.lines);
      if (!parsedLines.ok) return await rollbackJson(client, { error: parsedLines.error }, 422);
      const economics = calculateQuoteEconomics(parsedLines.value);
      const intentVersionId = body.intentVersionId == null ? null : positiveId(body.intentVersionId);
      const intentResult = intentVersionId
        ? await client.query(
            `SELECT id, revision FROM agency_intent_versions WHERE id = $1 AND workspace_id = $2 AND opportunity_id = $3 LIMIT 1`,
            [intentVersionId, workspaceId, opportunityId],
          )
        : await client.query(
            `SELECT id, revision FROM agency_intent_versions WHERE workspace_id = $1 AND opportunity_id = $2 ORDER BY revision DESC LIMIT 1`,
            [workspaceId, opportunityId],
          );
      const intent = intentResult.rows[0];
      if (!intent) return await rollbackJson(client, { error: "Traveler intent version not found." }, 409);

      let quoteId = body.quoteId == null ? null : positiveId(body.quoteId);
      if (body.quoteId != null && !quoteId) return await rollbackJson(client, { error: "quoteId is invalid." }, 422);
      if (quoteId) {
        const existing = await client.query(
          `SELECT id, status FROM agency_quotes WHERE id = $1 AND workspace_id = $2 AND opportunity_id = $3 LIMIT 1`,
          [quoteId, workspaceId, opportunityId],
        );
        if (!existing.rows[0]) return await rollbackJson(client, { error: "Quote not found." }, 404);
        if (["accepted", "declined", "expired", "superseded"].includes(existing.rows[0].status)) {
          return await rollbackJson(client, { error: "This quote is terminal; create a new quote instead." }, 409);
        }
      } else {
        const inserted = await client.query(
          `INSERT INTO agency_quotes (workspace_id, opportunity_id, status, created_by_account_id)
           VALUES ($1, $2, 'draft', $3) RETURNING id`,
          [workspaceId, opportunityId, access.account.id],
        );
        quoteId = inserted.rows[0]!.id;
      }

      const versionResult = await client.query(
        `SELECT COALESCE(MAX(version), 0)::int + 1 AS version FROM agency_quote_versions WHERE quote_id = $1`,
        [quoteId],
      );
      const version = Number(versionResult.rows[0]!.version);
      const validUntil = isoTimestamp(body.validUntil);
      if (body.validUntil != null && !validUntil) return await rollbackJson(client, { error: "validUntil must be an ISO timestamp." }, 422);
      const clientFacingTerms = nullableText(body.clientFacingTerms, 8000);
      const digest = quoteVersionDigest({
        quoteId,
        version,
        intentRevision: Number(intent.revision),
        lines: parsedLines.value,
        economics,
        clientFacingTerms,
        validUntil,
      });

      const insertedVersion = await client.query(
        `INSERT INTO agency_quote_versions
          (workspace_id, opportunity_id, quote_id, intent_version_id, version, currency,
           cost_total_minor, sell_total_minor, commission_expected_minor, gross_profit_minor,
           margin_bps, markup_bps, lines_snapshot, client_facing_terms, valid_until,
           integrity_digest, created_by_account_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17)
         RETURNING id, version, currency, sell_total_minor, gross_profit_minor, margin_bps, integrity_digest`,
        [
          workspaceId,
          opportunityId,
          quoteId,
          intent.id,
          version,
          economics.currency,
          economics.costTotalMinor,
          economics.sellTotalMinor,
          economics.commissionExpectedMinor,
          economics.grossProfitMinor,
          economics.marginBps,
          economics.markupBps,
          JSON.stringify(parsedLines.value),
          clientFacingTerms,
          validUntil,
          digest,
          access.account.id,
        ],
      );
      await client.query(
        `UPDATE agency_opportunities SET stage = CASE WHEN stage IN ('new','qualified') THEN 'sourcing' ELSE stage END, updated_at = NOW() WHERE id = $1`,
        [opportunityId],
      );
      await appendDomainEvent(client, {
        workspaceId,
        actorAccountId: access.account.id,
        eventType: "quote.version_created",
        referenceType: "quote",
        referenceId: quoteId,
        payload: { opportunityId, version, quoteVersionId: insertedVersion.rows[0]!.id, marginBps: economics.marginBps },
      });
      await client.query("COMMIT");
      return NextResponse.json({ quoteId, quoteVersion: insertedVersion.rows[0], economics }, { status: 201 });
    }

    if (command === "send_quote") {
      const quoteId = positiveId(body.quoteId);
      const quoteVersionId = positiveId(body.quoteVersionId);
      const channel = typeof body.channel === "string" && ["email", "whatsapp", "link", "manual"].includes(body.channel) ? body.channel : null;
      if (!quoteId || !quoteVersionId || !channel) return await rollbackJson(client, { error: "quoteId, quoteVersionId, and channel are required." }, 422);
      const version = await client.query(
        `SELECT qv.id, qv.opportunity_id, qv.valid_until
           FROM agency_quote_versions qv
           JOIN agency_quotes q ON q.id = qv.quote_id
          WHERE qv.id = $1 AND qv.quote_id = $2 AND qv.workspace_id = $3 AND q.workspace_id = $3
          LIMIT 1`,
        [quoteVersionId, quoteId, workspaceId],
      );
      const row = version.rows[0];
      if (!row) return await rollbackJson(client, { error: "Quote version not found." }, 404);
      if (row.valid_until && new Date(row.valid_until).getTime() < Date.now()) {
        return await rollbackJson(client, { error: "Quote version has expired; create a refreshed version before sending." }, 409);
      }
      const opportunity = await loadOpportunity(client, workspaceId, row.opportunity_id);
      if (!opportunity || terminal(opportunity.stage)) return await rollbackJson(client, { error: "Opportunity is terminal." }, 409);

      await client.query(`UPDATE agency_quotes SET status = 'sent', updated_at = NOW() WHERE id = $1`, [quoteId]);
      await client.query(`UPDATE agency_opportunities SET stage = 'quoted', updated_at = NOW() WHERE id = $1`, [row.opportunity_id]);
      await client.query(
        `INSERT INTO agency_commercial_activities
          (workspace_id, opportunity_id, quote_id, quote_version_id, activity_type, actor_account_id, channel, metadata)
         VALUES ($1,$2,$3,$4,'quote_sent',$5,$6,$7::jsonb)`,
        [workspaceId, row.opportunity_id, quoteId, quoteVersionId, access.account.id, channel, JSON.stringify({})],
      );
      await appendDomainEvent(client, {
        workspaceId,
        actorAccountId: access.account.id,
        eventType: "quote.sent",
        referenceType: "quote",
        referenceId: quoteId,
        payload: { quoteVersionId, channel },
      });
      await client.query("COMMIT");
      return NextResponse.json({ quoteId, quoteVersionId, status: "sent" });
    }

    if (command === "record_follow_up") {
      const opportunityId = positiveId(body.opportunityId);
      if (!opportunityId) return await rollbackJson(client, { error: "opportunityId is required." }, 422);
      const opportunity = await loadOpportunity(client, workspaceId, opportunityId);
      if (!opportunity) return await rollbackJson(client, { error: "Opportunity not found." }, 404);
      if (terminal(opportunity.stage)) return await rollbackJson(client, { error: "Terminal opportunities cannot receive follow-ups." }, 409);
      const quoteId = body.quoteId == null ? null : positiveId(body.quoteId);
      const quoteVersionId = body.quoteVersionId == null ? null : positiveId(body.quoteVersionId);
      const channel = nullableText(body.channel, 20);
      const note = nullableText(body.note, 2000);
      await client.query(
        `INSERT INTO agency_commercial_activities
          (workspace_id, opportunity_id, quote_id, quote_version_id, activity_type, actor_account_id, channel, metadata)
         VALUES ($1,$2,$3,$4,'follow_up',$5,$6,$7::jsonb)`,
        [workspaceId, opportunityId, quoteId, quoteVersionId, access.account.id, channel, JSON.stringify(note ? { note } : {})],
      );
      await client.query(
        `UPDATE agency_opportunities SET stage = CASE WHEN stage IN ('quoted','sourcing','qualified','new') THEN 'negotiating' ELSE stage END, updated_at = NOW() WHERE id = $1`,
        [opportunityId],
      );
      await appendDomainEvent(client, {
        workspaceId,
        actorAccountId: access.account.id,
        eventType: "opportunity.follow_up_recorded",
        referenceType: "opportunity",
        referenceId: opportunityId,
        payload: { quoteId, quoteVersionId, channel },
      });
      await client.query("COMMIT");
      return NextResponse.json({ opportunityId, status: "follow_up_recorded" });
    }

    if (command === "record_outcome") {
      const opportunityId = positiveId(body.opportunityId);
      const outcome = body.outcome === "won" || body.outcome === "lost" ? body.outcome : null;
      if (!opportunityId || !outcome) return await rollbackJson(client, { error: "opportunityId and won/lost outcome are required." }, 422);
      const opportunity = await loadOpportunity(client, workspaceId, opportunityId);
      if (!opportunity) return await rollbackJson(client, { error: "Opportunity not found." }, 404);
      if (terminal(opportunity.stage)) return await rollbackJson(client, { error: "Opportunity already has a terminal outcome." }, 409);
      const quoteVersionId = body.quoteVersionId == null ? null : positiveId(body.quoteVersionId);
      if (outcome === "won" && !quoteVersionId) return await rollbackJson(client, { error: "Won outcomes require the accepted quoteVersionId." }, 422);
      const reason = nullableText(body.reason, 2000);
      if (outcome === "lost" && !reason) return await rollbackJson(client, { error: "Lost outcomes require a reason for the learning loop." }, 422);

      let acceptedVersion: Record<string, unknown> | null = null;
      if (quoteVersionId) {
        const version = await client.query(
          `SELECT id, quote_id, currency, cost_total_minor, sell_total_minor, commission_expected_minor,
                  gross_profit_minor, margin_bps, markup_bps, valid_until
             FROM agency_quote_versions
            WHERE id = $1 AND workspace_id = $2 AND opportunity_id = $3 LIMIT 1`,
          [quoteVersionId, workspaceId, opportunityId],
        );
        acceptedVersion = version.rows[0] ?? null;
        if (!acceptedVersion) return await rollbackJson(client, { error: "Outcome quote version not found." }, 404);
      }

      await client.query(
        `UPDATE agency_opportunities
            SET stage = $1, outcome_reason = $2, won_quote_version_id = $3, closed_at = NOW(), updated_at = NOW()
          WHERE id = $4`,
        [outcome, reason, outcome === "won" ? quoteVersionId : null, opportunityId],
      );
      if (acceptedVersion) {
        await client.query(`UPDATE agency_quotes SET status = $1, updated_at = NOW() WHERE id = $2`, [outcome === "won" ? "accepted" : "declined", acceptedVersion.quote_id]);
      }
      await client.query(
        `INSERT INTO agency_commercial_activities
          (workspace_id, opportunity_id, quote_id, quote_version_id, activity_type, actor_account_id, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
        [workspaceId, opportunityId, acceptedVersion?.quote_id ?? null, quoteVersionId, outcome === "won" ? "outcome_won" : "outcome_lost", access.account.id, JSON.stringify(reason ? { reason } : {})],
      );

      if (acceptedVersion) {
        const economics: QuoteEconomics = {
          currency: String(acceptedVersion.currency),
          costTotalMinor: Number(acceptedVersion.cost_total_minor),
          sellTotalMinor: Number(acceptedVersion.sell_total_minor),
          commissionExpectedMinor: Number(acceptedVersion.commission_expected_minor),
          grossProfitMinor: Number(acceptedVersion.gross_profit_minor),
          marginBps: Number(acceptedVersion.margin_bps),
          markupBps: Number(acceptedVersion.markup_bps),
        };
        const signals = deriveCommercialSignals({
          stage: outcome as OpportunityStage,
          economics,
          lastActivityAt: new Date().toISOString(),
          quoteValidUntil: acceptedVersion.valid_until ? new Date(String(acceptedVersion.valid_until)).toISOString() : null,
        });
        for (const signal of signals) {
          await client.query(
            `INSERT INTO agency_intelligence_signals
              (workspace_id, opportunity_id, quote_version_id, signal_kind, severity, score, explanation, recommended_action, evidence)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
            [workspaceId, opportunityId, quoteVersionId, signal.kind, signal.severity, signal.score, signal.explanation, signal.recommendedAction, JSON.stringify({ economics })],
          );
        }
      }

      await appendDomainEvent(client, {
        workspaceId,
        actorAccountId: access.account.id,
        eventType: `opportunity.${outcome}`,
        referenceType: "opportunity",
        referenceId: opportunityId,
        payload: { quoteVersionId, reasonCode: reason ? "provided" : null },
      });
      await client.query("COMMIT");
      return NextResponse.json({ opportunityId, outcome });
    }

    if (command === "project_marketplace") {
      if (access.membership.role !== "owner") {
        return await rollbackJson(client, { error: "Only the workspace owner may create a public marketplace projection." }, 403);
      }
      if (body.confirmPublicProjection !== true) {
        return await rollbackJson(client, { error: "Explicit public projection confirmation is required." }, 422);
      }
      const quoteVersionId = positiveId(body.quoteVersionId);
      if (!quoteVersionId) return await rollbackJson(client, { error: "quoteVersionId is required." }, 422);
      const versionResult = await client.query(
        `SELECT qv.*, iv.intent_snapshot
           FROM agency_quote_versions qv
           JOIN agency_intent_versions iv ON iv.id = qv.intent_version_id
          WHERE qv.id = $1 AND qv.workspace_id = $2
          LIMIT 1`,
        [quoteVersionId, workspaceId],
      );
      const version = versionResult.rows[0];
      if (!version) return await rollbackJson(client, { error: "Quote version not found." }, 404);
      const intent = version.intent_snapshot as TravelerIntent;
      const lines = version.lines_snapshot;
      const economics: QuoteEconomics = {
        currency: String(version.currency),
        costTotalMinor: Number(version.cost_total_minor),
        sellTotalMinor: Number(version.sell_total_minor),
        commissionExpectedMinor: Number(version.commission_expected_minor),
        grossProfitMinor: Number(version.gross_profit_minor),
        marginBps: Number(version.margin_bps),
        markupBps: Number(version.markup_bps),
      };
      const projection = buildMarketplaceProjection({
        consent: true,
        intent,
        economics,
        lines,
        title: String(body.title ?? ""),
        description: String(body.description ?? ""),
        destinationCountry: String(body.destinationCountry ?? ""),
        heroImage: String(body.heroImage ?? ""),
      });
      if (!projection.ok) return await rollbackJson(client, { error: projection.error }, 422);

      const inserted = await client.query(
        `INSERT INTO agency_marketplace_projections
          (workspace_id, opportunity_id, quote_version_id, status, projection_payload, created_by_account_id)
         VALUES ($1,$2,$3,'draft',$4::jsonb,$5)
         ON CONFLICT (quote_version_id) DO UPDATE
           SET projection_payload = EXCLUDED.projection_payload, status = 'draft', updated_at = NOW()
         RETURNING id, status, projection_payload`,
        [workspaceId, version.opportunity_id, quoteVersionId, JSON.stringify(projection.value), access.account.id],
      );
      await appendDomainEvent(client, {
        workspaceId,
        actorAccountId: access.account.id,
        eventType: "marketplace.projection_created",
        referenceType: "quote_version",
        referenceId: quoteVersionId,
        payload: { projectionId: inserted.rows[0]!.id, status: "draft" },
      });
      await client.query("COMMIT");
      return NextResponse.json({ projection: inserted.rows[0] }, { status: 201 });
    }

    return await rollbackJson(client, { error: "Unknown commercial command." }, 422);
  } catch (error) {
    await client.query("ROLLBACK");
    const code = (error as { code?: string }).code;
    if (code === "23505") return NextResponse.json({ error: "This commercial record already exists." }, { status: 409 });
    console.error("Agency commercial command failed", error);
    return NextResponse.json({ error: "Commercial workflow failed safely." }, { status: 500 });
  } finally {
    client.release();
  }
}

async function rollbackJson(
  client: Awaited<ReturnType<typeof pool.connect>>,
  body: Record<string, unknown>,
  status: number,
) {
  await client.query("ROLLBACK");
  return NextResponse.json(body, { status });
}

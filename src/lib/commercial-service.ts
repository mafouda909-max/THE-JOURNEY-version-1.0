import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db";
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
  type QuoteLineInput,
  type TravelerIntent,
} from "@/lib/commercial-domain";

export type CommercialActor = {
  workspaceId: number;
  agentId: number;
  accountId: number;
  membershipRole: "owner" | "member";
};

type Json = Record<string, unknown>;
export type CommercialServiceResult = { status: number; body: Json };

const terminalStages = new Set(["won", "lost", "cancelled"]);

function ok(body: Json, status = 200): CommercialServiceResult {
  return { status, body };
}

function fail(error: string, status: number): CommercialServiceResult {
  return { status, body: { error } };
}

function positiveId(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isSafeInteger(parsed) && Number(parsed) > 0 ? Number(parsed) : null;
}

function nonNegativeMinor(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isSafeInteger(parsed) && Number(parsed) >= 0 ? Number(parsed) : null;
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

function stageIsTerminal(stage: unknown): boolean {
  return typeof stage === "string" && terminalStages.has(stage);
}

function economicsFromRow(row: Record<string, unknown>): QuoteEconomics {
  const costTotalMinor = nonNegativeMinor(row.cost_total_minor);
  const sellTotalMinor = nonNegativeMinor(row.sell_total_minor);
  const commissionExpectedMinor = nonNegativeMinor(row.commission_expected_minor);
  const grossProfitMinor = Number(row.gross_profit_minor);
  const marginBps = Number(row.margin_bps);
  const markupBps = Number(row.markup_bps);
  if (
    costTotalMinor === null ||
    sellTotalMinor === null ||
    commissionExpectedMinor === null ||
    !Number.isSafeInteger(grossProfitMinor) ||
    !Number.isSafeInteger(marginBps) ||
    !Number.isSafeInteger(markupBps)
  ) {
    throw new Error("Stored quote economics exceed application precision.");
  }
  return {
    currency: String(row.currency),
    costTotalMinor,
    sellTotalMinor,
    commissionExpectedMinor,
    grossProfitMinor,
    marginBps,
    markupBps,
  };
}

async function appendDomainEvent(
  client: PoolClient,
  actor: CommercialActor,
  input: {
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
      actor.workspaceId,
      actor.accountId,
      input.eventType,
      JSON.stringify(sanitizeAgencyEventPayload(input.payload)),
      input.referenceType,
      input.referenceId,
      randomUUID(),
    ],
  );
}

async function loadOpportunity(client: PoolClient, actor: CommercialActor, opportunityId: number) {
  const result = await client.query(
    `SELECT o.*, c.display_name AS client_display_name
       FROM agency_opportunities o
       JOIN agency_clients c ON c.id = o.client_id AND c.workspace_id = o.workspace_id
      WHERE o.id = $1 AND o.workspace_id = $2
      LIMIT 1`,
    [opportunityId, actor.workspaceId],
  );
  return result.rows[0] as Record<string, unknown> | undefined;
}

async function resolveQuoteLinkage(
  client: PoolClient,
  actor: CommercialActor,
  opportunityId: number,
  quoteId: number | null,
  quoteVersionId: number | null,
): Promise<{ quoteId: number | null; quoteVersionId: number | null } | null> {
  if (!quoteId && !quoteVersionId) return { quoteId: null, quoteVersionId: null };

  const result = await client.query(
    `SELECT q.id AS quote_id, qv.id AS quote_version_id
       FROM agency_quotes q
       LEFT JOIN agency_quote_versions qv
         ON qv.quote_id = q.id
        AND qv.workspace_id = q.workspace_id
        AND qv.opportunity_id = q.opportunity_id
        AND ($4::integer IS NULL OR qv.id = $4)
      WHERE q.workspace_id = $1
        AND q.opportunity_id = $2
        AND ($3::integer IS NULL OR q.id = $3)
        AND ($4::integer IS NULL OR qv.id = $4)
      ORDER BY qv.version DESC NULLS LAST
      LIMIT 1`,
    [actor.workspaceId, opportunityId, quoteId, quoteVersionId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    quoteId: positiveId(row.quote_id),
    quoteVersionId: positiveId(row.quote_version_id),
  };
}

async function validateSupplierOptionOwnership(
  client: PoolClient,
  actor: CommercialActor,
  opportunityId: number,
  lines: readonly QuoteLineInput[],
): Promise<boolean> {
  const ids = [...new Set(lines.map((line) => line.supplierOptionId).filter((id): id is number => id !== null))];
  if (ids.length === 0) return true;
  const result = await client.query(
    `SELECT id
       FROM agency_supplier_options
      WHERE workspace_id = $1
        AND opportunity_id = $2
        AND id = ANY($3::integer[])
        AND status IN ('active','selected')`,
    [actor.workspaceId, opportunityId, ids],
  );
  return result.rows.length === ids.length;
}

async function createOpportunity(client: PoolClient, actor: CommercialActor, body: Json): Promise<CommercialServiceResult> {
  const source = typeof body.source === "string" && ["marketplace", "manual", "referral", "repeat", "partner"].includes(body.source)
    ? body.source as OpportunitySource
    : null;
  if (!source) return fail("Opportunity source is invalid.", 422);

  const parsedIntent = parseTravelerIntent(body.intent);
  if (!parsedIntent.ok) return fail(parsedIntent.error, 422);

  const sourceContactRequestId = body.sourceContactRequestId == null ? null : positiveId(body.sourceContactRequestId);
  if (body.sourceContactRequestId != null && !sourceContactRequestId) return fail("sourceContactRequestId is invalid.", 422);
  if (sourceContactRequestId && source !== "marketplace") return fail("Only marketplace opportunities may bind a contact request.", 422);

  let clientName: string | null = null;
  let clientEmail: string | null = null;
  let clientPhone: string | null = null;
  let platformAccountId: number | null = null;

  if (sourceContactRequestId) {
    const contact = await client.query(
      `SELECT traveler_account_id, traveler_name, traveler_email
         FROM contact_requests
        WHERE id = $1 AND agent_id = $2
        LIMIT 1`,
      [sourceContactRequestId, actor.agentId],
    );
    const row = contact.rows[0];
    if (!row) return fail("Marketplace inquiry not found for this agency.", 404);
    clientName = text(row.traveler_name, 240);
    clientEmail = email(row.traveler_email);
    platformAccountId = positiveId(row.traveler_account_id);
  } else {
    const clientInput = body.client && typeof body.client === "object" && !Array.isArray(body.client)
      ? body.client as Json
      : null;
    clientName = clientInput ? text(clientInput.displayName, 240) : null;
    clientEmail = clientInput ? email(clientInput.email) : null;
    clientPhone = clientInput ? nullableText(clientInput.phone, 80) : null;
    if (!clientName || (!clientEmail && !clientPhone)) return fail("Client name plus email or phone is required.", 422);
  }
  if (!clientName) return fail("Traveler identity could not be normalized.", 422);

  let agencyClientId: number | null = null;
  if (platformAccountId) {
    const existingByAccount = await client.query(
      `SELECT id FROM agency_clients WHERE workspace_id = $1 AND platform_account_id = $2 LIMIT 1`,
      [actor.workspaceId, platformAccountId],
    );
    agencyClientId = positiveId(existingByAccount.rows[0]?.id);
  }
  if (!agencyClientId && clientEmail) {
    const existingByEmail = await client.query(
      `SELECT id FROM agency_clients WHERE workspace_id = $1 AND lower(email) = lower($2) LIMIT 1`,
      [actor.workspaceId, clientEmail],
    );
    agencyClientId = positiveId(existingByEmail.rows[0]?.id);
  }
  if (!agencyClientId) {
    const insertedClient = await client.query(
      `INSERT INTO agency_clients
        (workspace_id, platform_account_id, display_name, email, phone, created_by_account_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [actor.workspaceId, platformAccountId, clientName, clientEmail, clientPhone, actor.accountId],
    );
    agencyClientId = positiveId(insertedClient.rows[0]?.id);
  }
  if (!agencyClientId) throw new Error("Agency client insert did not return an id.");

  const insertedOpportunity = await client.query(
    `INSERT INTO agency_opportunities
      (workspace_id, client_id, source, source_contact_request_id, stage, assigned_account_id, title, created_by_account_id)
     VALUES ($1, $2, $3, $4, 'new', $5, $6, $5)
     RETURNING id, source, stage, title, created_at AS "createdAt"`,
    [actor.workspaceId, agencyClientId, source, sourceContactRequestId, actor.accountId, nullableText(body.title, 240)],
  );
  const opportunity = insertedOpportunity.rows[0] as Record<string, unknown>;
  const opportunityId = positiveId(opportunity.id);
  if (!opportunityId) throw new Error("Opportunity insert did not return an id.");

  await client.query(
    `INSERT INTO agency_intent_versions
      (workspace_id, opportunity_id, revision, intent_snapshot, provenance, created_by_account_id)
     VALUES ($1, $2, 1, $3::jsonb, $4::jsonb, $5)`,
    [actor.workspaceId, opportunityId, JSON.stringify(parsedIntent.value), JSON.stringify({ source }), actor.accountId],
  );
  await appendDomainEvent(client, actor, {
    eventType: "opportunity.created",
    referenceType: "opportunity",
    referenceId: opportunityId,
    payload: { source, intentRevision: 1 },
  });

  return ok({ opportunity, intentRevision: 1 }, 201);
}

async function addIntentVersion(client: PoolClient, actor: CommercialActor, body: Json): Promise<CommercialServiceResult> {
  const opportunityId = positiveId(body.opportunityId);
  if (!opportunityId) return fail("opportunityId is required.", 422);
  const opportunity = await loadOpportunity(client, actor, opportunityId);
  if (!opportunity) return fail("Opportunity not found.", 404);
  if (stageIsTerminal(opportunity.stage)) return fail("Terminal opportunities cannot receive new intent versions.", 409);
  const parsedIntent = parseTravelerIntent(body.intent);
  if (!parsedIntent.ok) return fail(parsedIntent.error, 422);

  const revisionResult = await client.query(
    `SELECT COALESCE(MAX(revision), 0)::int + 1 AS revision
       FROM agency_intent_versions
      WHERE workspace_id = $1 AND opportunity_id = $2`,
    [actor.workspaceId, opportunityId],
  );
  const revision = Number(revisionResult.rows[0]?.revision);
  if (!Number.isSafeInteger(revision) || revision <= 0) throw new Error("Could not calculate next intent revision.");

  await client.query(
    `INSERT INTO agency_intent_versions
      (workspace_id, opportunity_id, revision, intent_snapshot, provenance, created_by_account_id)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
    [actor.workspaceId, opportunityId, revision, JSON.stringify(parsedIntent.value), JSON.stringify({ source: "agent_revision" }), actor.accountId],
  );
  await client.query(
    `UPDATE agency_opportunities
        SET stage = CASE WHEN stage = 'new' THEN 'qualified' ELSE stage END, updated_at = NOW()
      WHERE id = $1 AND workspace_id = $2`,
    [opportunityId, actor.workspaceId],
  );
  await appendDomainEvent(client, actor, {
    eventType: "traveler_intent.versioned",
    referenceType: "opportunity",
    referenceId: opportunityId,
    payload: { revision },
  });
  return ok({ opportunityId, revision }, 201);
}

async function recordSupplierOption(client: PoolClient, actor: CommercialActor, body: Json): Promise<CommercialServiceResult> {
  const opportunityId = positiveId(body.opportunityId);
  if (!opportunityId) return fail("opportunityId is required.", 422);
  const opportunity = await loadOpportunity(client, actor, opportunityId);
  if (!opportunity) return fail("Opportunity not found.", 404);
  if (stageIsTerminal(opportunity.stage)) return fail("Terminal opportunities cannot receive supplier options.", 409);

  const category = typeof body.category === "string" && ["flight", "hotel", "transfer", "activity", "insurance", "visa", "fee", "other"].includes(body.category) ? body.category : null;
  const sourceType = typeof body.sourceType === "string" && ["supplier_quote", "booking_engine", "contract", "manual", "platform"].includes(body.sourceType) ? body.sourceType : null;
  const supplierName = text(body.supplierName, 240);
  const description = text(body.description, 1000);
  const normalizedCurrency = typeof body.currency === "string" ? body.currency.toUpperCase() : "";
  const currency = /^[A-Z]{3}$/.test(normalizedCurrency) ? normalizedCurrency : null;
  const costAmountMinor = nonNegativeMinor(body.costAmountMinor);
  const commissionExpectedMinor = nonNegativeMinor(body.commissionExpectedMinor ?? 0);
  const observedAt = isoTimestamp(body.observedAt);
  const validUntil = isoTimestamp(body.validUntil);
  const sourceRef = nullableText(body.sourceRef, 1000);
  if (!category || !sourceType || !supplierName || !description || !currency || costAmountMinor === null || commissionExpectedMinor === null || !observedAt) {
    return fail("Supplier option fields or provenance are invalid.", 422);
  }
  if (body.validUntil != null && !validUntil) return fail("validUntil must be an ISO timestamp.", 422);
  if (validUntil && validUntil < observedAt) return fail("Supplier validity cannot end before observation.", 422);

  const inserted = await client.query(
    `INSERT INTO agency_supplier_options
      (workspace_id, opportunity_id, category, supplier_name, description, currency, cost_amount_minor,
       commission_expected_minor, source_type, source_ref, observed_at, valid_until, status, created_by_account_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active',$13)
     RETURNING id, category, supplier_name AS "supplierName", description, currency,
       cost_amount_minor AS "costAmountMinor", commission_expected_minor AS "commissionExpectedMinor",
       source_type AS "sourceType", source_ref AS "sourceRef", observed_at AS "observedAt", valid_until AS "validUntil"`,
    [actor.workspaceId, opportunityId, category, supplierName, description, currency, costAmountMinor, commissionExpectedMinor, sourceType, sourceRef, observedAt, validUntil, actor.accountId],
  );
  const option = inserted.rows[0] as Record<string, unknown>;
  const optionId = positiveId(option.id);
  if (!optionId) throw new Error("Supplier option insert did not return an id.");
  await client.query(
    `UPDATE agency_opportunities
        SET stage = CASE WHEN stage IN ('new','qualified') THEN 'sourcing' ELSE stage END, updated_at = NOW()
      WHERE id = $1 AND workspace_id = $2`,
    [opportunityId, actor.workspaceId],
  );
  await appendDomainEvent(client, actor, {
    eventType: "supplier_option.recorded",
    referenceType: "supplier_option",
    referenceId: optionId,
    payload: { opportunityId, category, sourceType, validUntil },
  });
  return ok({ supplierOption: option }, 201);
}

async function createQuoteVersion(client: PoolClient, actor: CommercialActor, body: Json): Promise<CommercialServiceResult> {
  const opportunityId = positiveId(body.opportunityId);
  if (!opportunityId) return fail("opportunityId is required.", 422);
  const opportunity = await loadOpportunity(client, actor, opportunityId);
  if (!opportunity) return fail("Opportunity not found.", 404);
  if (stageIsTerminal(opportunity.stage)) return fail("Terminal opportunities cannot receive quote versions.", 409);

  const parsedLines = parseQuoteLines(body.lines);
  if (!parsedLines.ok) return fail(parsedLines.error, 422);
  if (!await validateSupplierOptionOwnership(client, actor, opportunityId, parsedLines.value)) {
    return fail("One or more supplier options do not belong to this opportunity or are no longer selectable.", 422);
  }
  const economics = calculateQuoteEconomics(parsedLines.value);

  const intentVersionId = body.intentVersionId == null ? null : positiveId(body.intentVersionId);
  if (body.intentVersionId != null && !intentVersionId) return fail("intentVersionId is invalid.", 422);
  const intentResult = intentVersionId
    ? await client.query(
        `SELECT id, revision FROM agency_intent_versions WHERE id = $1 AND workspace_id = $2 AND opportunity_id = $3 LIMIT 1`,
        [intentVersionId, actor.workspaceId, opportunityId],
      )
    : await client.query(
        `SELECT id, revision FROM agency_intent_versions WHERE workspace_id = $1 AND opportunity_id = $2 ORDER BY revision DESC LIMIT 1`,
        [actor.workspaceId, opportunityId],
      );
  const intent = intentResult.rows[0];
  const resolvedIntentId = positiveId(intent?.id);
  const intentRevision = Number(intent?.revision);
  if (!resolvedIntentId || !Number.isSafeInteger(intentRevision)) return fail("Traveler intent version not found.", 409);

  let quoteId = body.quoteId == null ? null : positiveId(body.quoteId);
  if (body.quoteId != null && !quoteId) return fail("quoteId is invalid.", 422);
  if (quoteId) {
    const existing = await client.query(
      `SELECT id, status FROM agency_quotes WHERE id = $1 AND workspace_id = $2 AND opportunity_id = $3 LIMIT 1`,
      [quoteId, actor.workspaceId, opportunityId],
    );
    if (!existing.rows[0]) return fail("Quote not found.", 404);
    if (["accepted", "declined", "expired", "superseded"].includes(existing.rows[0].status)) {
      return fail("This quote is terminal; create a new quote instead.", 409);
    }
  } else {
    const inserted = await client.query(
      `INSERT INTO agency_quotes (workspace_id, opportunity_id, status, created_by_account_id)
       VALUES ($1, $2, 'draft', $3) RETURNING id`,
      [actor.workspaceId, opportunityId, actor.accountId],
    );
    quoteId = positiveId(inserted.rows[0]?.id);
  }
  if (!quoteId) throw new Error("Quote insert did not return an id.");

  const versionResult = await client.query(
    `SELECT COALESCE(MAX(version), 0)::int + 1 AS version
       FROM agency_quote_versions
      WHERE quote_id = $1 AND workspace_id = $2`,
    [quoteId, actor.workspaceId],
  );
  const version = Number(versionResult.rows[0]?.version);
  if (!Number.isSafeInteger(version) || version <= 0) throw new Error("Could not calculate quote version.");

  const validUntil = isoTimestamp(body.validUntil);
  if (body.validUntil != null && !validUntil) return fail("validUntil must be an ISO timestamp.", 422);
  if (validUntil && new Date(validUntil).getTime() <= Date.now()) return fail("A new quote version must still be valid.", 422);
  const clientFacingTerms = nullableText(body.clientFacingTerms, 8000);
  const digest = quoteVersionDigest({
    quoteId,
    version,
    intentRevision,
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
     RETURNING id, version, currency, sell_total_minor AS "sellTotalMinor",
       gross_profit_minor AS "grossProfitMinor", margin_bps AS "marginBps", integrity_digest AS "integrityDigest"`,
    [
      actor.workspaceId,
      opportunityId,
      quoteId,
      resolvedIntentId,
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
      actor.accountId,
    ],
  );
  await client.query(
    `UPDATE agency_opportunities
        SET stage = CASE WHEN stage IN ('new','qualified') THEN 'sourcing' ELSE stage END, updated_at = NOW()
      WHERE id = $1 AND workspace_id = $2`,
    [opportunityId, actor.workspaceId],
  );
  const quoteVersion = insertedVersion.rows[0] as Record<string, unknown>;
  await appendDomainEvent(client, actor, {
    eventType: "quote.version_created",
    referenceType: "quote",
    referenceId: quoteId,
    payload: { opportunityId, version, quoteVersionId: quoteVersion.id, marginBps: economics.marginBps },
  });
  return ok({ quoteId, quoteVersion, economics }, 201);
}

async function sendQuote(client: PoolClient, actor: CommercialActor, body: Json): Promise<CommercialServiceResult> {
  const quoteId = positiveId(body.quoteId);
  const quoteVersionId = positiveId(body.quoteVersionId);
  const channel = typeof body.channel === "string" && ["email", "whatsapp", "link", "manual"].includes(body.channel) ? body.channel : null;
  if (!quoteId || !quoteVersionId || !channel) return fail("quoteId, quoteVersionId, and channel are required.", 422);

  const versionResult = await client.query(
    `SELECT qv.id, qv.opportunity_id, qv.valid_until, q.status AS quote_status
       FROM agency_quote_versions qv
       JOIN agency_quotes q
         ON q.id = qv.quote_id
        AND q.workspace_id = qv.workspace_id
        AND q.opportunity_id = qv.opportunity_id
      WHERE qv.id = $1 AND qv.quote_id = $2 AND qv.workspace_id = $3
      LIMIT 1`,
    [quoteVersionId, quoteId, actor.workspaceId],
  );
  const row = versionResult.rows[0];
  const opportunityId = positiveId(row?.opportunity_id);
  if (!row || !opportunityId) return fail("Quote version not found.", 404);
  if (["accepted", "declined", "expired", "superseded"].includes(row.quote_status)) return fail("This quote is terminal and cannot be sent.", 409);
  if (row.valid_until && new Date(row.valid_until).getTime() < Date.now()) {
    await client.query(`UPDATE agency_quotes SET status = 'expired', updated_at = NOW() WHERE id = $1 AND workspace_id = $2`, [quoteId, actor.workspaceId]);
    return fail("Quote version has expired; create a refreshed version before sending.", 409);
  }
  const opportunity = await loadOpportunity(client, actor, opportunityId);
  if (!opportunity || stageIsTerminal(opportunity.stage)) return fail("Opportunity is terminal.", 409);

  await client.query(`UPDATE agency_quotes SET status = 'sent', updated_at = NOW() WHERE id = $1 AND workspace_id = $2`, [quoteId, actor.workspaceId]);
  await client.query(`UPDATE agency_opportunities SET stage = 'quoted', updated_at = NOW() WHERE id = $1 AND workspace_id = $2`, [opportunityId, actor.workspaceId]);
  await client.query(
    `INSERT INTO agency_commercial_activities
      (workspace_id, opportunity_id, quote_id, quote_version_id, activity_type, actor_account_id, channel, metadata)
     VALUES ($1,$2,$3,$4,'quote_sent',$5,$6,'{}'::jsonb)`,
    [actor.workspaceId, opportunityId, quoteId, quoteVersionId, actor.accountId, channel],
  );
  await appendDomainEvent(client, actor, {
    eventType: "quote.sent",
    referenceType: "quote",
    referenceId: quoteId,
    payload: { quoteVersionId, channel },
  });
  return ok({ quoteId, quoteVersionId, status: "sent" });
}

async function recordFollowUp(client: PoolClient, actor: CommercialActor, body: Json): Promise<CommercialServiceResult> {
  const opportunityId = positiveId(body.opportunityId);
  if (!opportunityId) return fail("opportunityId is required.", 422);
  const opportunity = await loadOpportunity(client, actor, opportunityId);
  if (!opportunity) return fail("Opportunity not found.", 404);
  if (stageIsTerminal(opportunity.stage)) return fail("Terminal opportunities cannot receive follow-ups.", 409);

  const requestedQuoteId = body.quoteId == null ? null : positiveId(body.quoteId);
  const requestedQuoteVersionId = body.quoteVersionId == null ? null : positiveId(body.quoteVersionId);
  if (body.quoteId != null && !requestedQuoteId) return fail("quoteId is invalid.", 422);
  if (body.quoteVersionId != null && !requestedQuoteVersionId) return fail("quoteVersionId is invalid.", 422);
  const resolved = await resolveQuoteLinkage(client, actor, opportunityId, requestedQuoteId, requestedQuoteVersionId);
  if (!resolved) return fail("Quote linkage does not belong to this opportunity.", 404);

  const channel = nullableText(body.channel, 20);
  const note = nullableText(body.note, 2000);
  await client.query(
    `INSERT INTO agency_commercial_activities
      (workspace_id, opportunity_id, quote_id, quote_version_id, activity_type, actor_account_id, channel, metadata)
     VALUES ($1,$2,$3,$4,'follow_up',$5,$6,$7::jsonb)`,
    [actor.workspaceId, opportunityId, resolved.quoteId, resolved.quoteVersionId, actor.accountId, channel, JSON.stringify(note ? { note } : {})],
  );
  await client.query(
    `UPDATE agency_opportunities
        SET stage = CASE WHEN stage IN ('quoted','sourcing','qualified','new') THEN 'negotiating' ELSE stage END, updated_at = NOW()
      WHERE id = $1 AND workspace_id = $2`,
    [opportunityId, actor.workspaceId],
  );
  await appendDomainEvent(client, actor, {
    eventType: "opportunity.follow_up_recorded",
    referenceType: "opportunity",
    referenceId: opportunityId,
    payload: { quoteId: resolved.quoteId, quoteVersionId: resolved.quoteVersionId, channel },
  });
  return ok({ opportunityId, status: "follow_up_recorded" });
}

async function recordOutcome(client: PoolClient, actor: CommercialActor, body: Json): Promise<CommercialServiceResult> {
  const opportunityId = positiveId(body.opportunityId);
  const outcome = body.outcome === "won" || body.outcome === "lost" ? body.outcome : null;
  if (!opportunityId || !outcome) return fail("opportunityId and won/lost outcome are required.", 422);
  const opportunity = await loadOpportunity(client, actor, opportunityId);
  if (!opportunity) return fail("Opportunity not found.", 404);
  if (stageIsTerminal(opportunity.stage)) return fail("Opportunity already has a terminal outcome.", 409);

  const quoteVersionId = body.quoteVersionId == null ? null : positiveId(body.quoteVersionId);
  if (body.quoteVersionId != null && !quoteVersionId) return fail("quoteVersionId is invalid.", 422);
  if (outcome === "won" && !quoteVersionId) return fail("Won outcomes require the accepted quoteVersionId.", 422);
  const reason = nullableText(body.reason, 2000);
  if (outcome === "lost" && !reason) return fail("Lost outcomes require a reason for the learning loop.", 422);

  let acceptedVersion: Record<string, unknown> | null = null;
  if (quoteVersionId) {
    const version = await client.query(
      `SELECT qv.id, qv.quote_id, qv.currency, qv.cost_total_minor, qv.sell_total_minor,
              qv.commission_expected_minor, qv.gross_profit_minor, qv.margin_bps, qv.markup_bps,
              qv.valid_until, q.status AS quote_status
         FROM agency_quote_versions qv
         JOIN agency_quotes q
           ON q.id = qv.quote_id
          AND q.workspace_id = qv.workspace_id
          AND q.opportunity_id = qv.opportunity_id
        WHERE qv.id = $1 AND qv.workspace_id = $2 AND qv.opportunity_id = $3 LIMIT 1`,
      [quoteVersionId, actor.workspaceId, opportunityId],
    );
    acceptedVersion = (version.rows[0] as Record<string, unknown> | undefined) ?? null;
    if (!acceptedVersion) return fail("Outcome quote version not found.", 404);
  }

  await client.query(
    `UPDATE agency_opportunities
        SET stage = $1, outcome_reason = $2, won_quote_version_id = $3, closed_at = NOW(), updated_at = NOW()
      WHERE id = $4 AND workspace_id = $5`,
    [outcome, reason, outcome === "won" ? quoteVersionId : null, opportunityId, actor.workspaceId],
  );
  const quoteId = acceptedVersion ? positiveId(acceptedVersion.quote_id) : null;
  if (quoteId) {
    await client.query(
      `UPDATE agency_quotes SET status = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3`,
      [outcome === "won" ? "accepted" : "declined", quoteId, actor.workspaceId],
    );
  }
  await client.query(
    `INSERT INTO agency_commercial_activities
      (workspace_id, opportunity_id, quote_id, quote_version_id, activity_type, actor_account_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [actor.workspaceId, opportunityId, quoteId, quoteVersionId, outcome === "won" ? "outcome_won" : "outcome_lost", actor.accountId, JSON.stringify(reason ? { reason } : {})],
  );

  if (acceptedVersion) {
    const economics = economicsFromRow(acceptedVersion);
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
        [actor.workspaceId, opportunityId, quoteVersionId, signal.kind, signal.severity, signal.score, signal.explanation, signal.recommendedAction, JSON.stringify({ economics })],
      );
    }
  }

  await appendDomainEvent(client, actor, {
    eventType: `opportunity.${outcome}`,
    referenceType: "opportunity",
    referenceId: opportunityId,
    payload: { quoteVersionId, reasonCaptured: Boolean(reason) },
  });
  return ok({ opportunityId, outcome });
}

async function projectMarketplace(client: PoolClient, actor: CommercialActor, body: Json): Promise<CommercialServiceResult> {
  if (actor.membershipRole !== "owner") return fail("Only the workspace owner may create a public marketplace projection.", 403);
  if (body.confirmPublicProjection !== true) return fail("Explicit public projection confirmation is required.", 422);
  const quoteVersionId = positiveId(body.quoteVersionId);
  if (!quoteVersionId) return fail("quoteVersionId is required.", 422);

  const versionResult = await client.query(
    `SELECT qv.*, iv.intent_snapshot
       FROM agency_quote_versions qv
       JOIN agency_intent_versions iv
         ON iv.id = qv.intent_version_id
        AND iv.workspace_id = qv.workspace_id
        AND iv.opportunity_id = qv.opportunity_id
      WHERE qv.id = $1 AND qv.workspace_id = $2
      LIMIT 1`,
    [quoteVersionId, actor.workspaceId],
  );
  const version = versionResult.rows[0] as Record<string, unknown> | undefined;
  if (!version) return fail("Quote version not found.", 404);
  const opportunityId = positiveId(version.opportunity_id);
  if (!opportunityId) throw new Error("Stored quote version has no valid opportunity id.");
  const economics = economicsFromRow(version);
  const projection = buildMarketplaceProjection({
    consent: true,
    intent: version.intent_snapshot as TravelerIntent,
    economics,
    lines: version.lines_snapshot as QuoteLineInput[],
    title: String(body.title ?? ""),
    description: String(body.description ?? ""),
    destinationCountry: String(body.destinationCountry ?? ""),
    heroImage: String(body.heroImage ?? ""),
  });
  if (!projection.ok) return fail(projection.error, 422);

  const inserted = await client.query(
    `INSERT INTO agency_marketplace_projections
      (workspace_id, opportunity_id, quote_version_id, status, projection_payload, created_by_account_id)
     VALUES ($1,$2,$3,'draft',$4::jsonb,$5)
     ON CONFLICT (quote_version_id) DO UPDATE
       SET projection_payload = EXCLUDED.projection_payload, status = 'draft', updated_at = NOW()
     RETURNING id, status, projection_payload AS "projectionPayload"`,
    [actor.workspaceId, opportunityId, quoteVersionId, JSON.stringify(projection.value), actor.accountId],
  );
  const marketplaceProjection = inserted.rows[0] as Record<string, unknown>;
  await appendDomainEvent(client, actor, {
    eventType: "marketplace.projection_created",
    referenceType: "quote_version",
    referenceId: quoteVersionId,
    payload: { projectionId: marketplaceProjection.id, status: "draft" },
  });
  return ok({ projection: marketplaceProjection }, 201);
}

export async function listCommercialPipeline(workspaceId: number): Promise<Json[]> {
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
       qv.quote_id AS "quoteId",
       qv.id AS "quoteVersionId",
       qv.version AS "quoteVersion",
       qv.currency,
       qv.sell_total_minor AS "sellTotalMinor",
       qv.gross_profit_minor AS "grossProfitMinor",
       qv.margin_bps AS "marginBps",
       qv.valid_until AS "quoteValidUntil",
       activity.occurred_at AS "lastActivityAt"
     FROM agency_opportunities o
     JOIN agency_clients c ON c.id = o.client_id AND c.workspace_id = o.workspace_id
     LEFT JOIN LATERAL (
       SELECT revision, intent_snapshot
         FROM agency_intent_versions
        WHERE workspace_id = o.workspace_id AND opportunity_id = o.id
        ORDER BY revision DESC LIMIT 1
     ) iv ON TRUE
     LEFT JOIN LATERAL (
       SELECT id, quote_id, version, currency, sell_total_minor, gross_profit_minor, margin_bps, valid_until
         FROM agency_quote_versions
        WHERE workspace_id = o.workspace_id AND opportunity_id = o.id
        ORDER BY created_at DESC, version DESC LIMIT 1
     ) qv ON TRUE
     LEFT JOIN LATERAL (
       SELECT occurred_at
         FROM agency_commercial_activities
        WHERE workspace_id = o.workspace_id AND opportunity_id = o.id
        ORDER BY occurred_at DESC LIMIT 1
     ) activity ON TRUE
     WHERE o.workspace_id = $1
     ORDER BY CASE o.stage
       WHEN 'negotiating' THEN 1 WHEN 'quoted' THEN 2 WHEN 'sourcing' THEN 3
       WHEN 'qualified' THEN 4 WHEN 'new' THEN 5 ELSE 6 END,
       o.updated_at DESC`,
    [workspaceId],
  );
  return result.rows as Json[];
}

export async function executeCommercialCommand(actor: CommercialActor, body: Json): Promise<CommercialServiceResult> {
  const command = text(body.command, 40);
  if (!command) return fail("Commercial command is required.", 422);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let result: CommercialServiceResult;
    switch (command) {
      case "create_opportunity":
        result = await createOpportunity(client, actor, body);
        break;
      case "add_intent_version":
        result = await addIntentVersion(client, actor, body);
        break;
      case "record_supplier_option":
        result = await recordSupplierOption(client, actor, body);
        break;
      case "create_quote_version":
        result = await createQuoteVersion(client, actor, body);
        break;
      case "send_quote":
        result = await sendQuote(client, actor, body);
        break;
      case "record_follow_up":
        result = await recordFollowUp(client, actor, body);
        break;
      case "record_outcome":
        result = await recordOutcome(client, actor, body);
        break;
      case "project_marketplace":
        result = await projectMarketplace(client, actor, body);
        break;
      default:
        result = fail("Unknown commercial command.", 422);
    }

    if (result.status >= 400) {
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
    }
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    const code = (error as { code?: string }).code;
    if (code === "23505") return fail("This commercial record already exists.", 409);
    if (code === "23503" || code === "23514") return fail("Commercial data failed an integrity constraint.", 422);
    console.error("Agency commercial command failed", error);
    return fail("Commercial workflow failed safely.", 500);
  } finally {
    client.release();
  }
}

import { NextResponse } from "next/server";
import { pool } from "@/db";
import { getAgencyWorkspaceAccess } from "@/lib/agency-access";
import { deriveCommercialSignals, type OpportunityStage, type QuoteEconomics } from "@/lib/commercial-domain";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; opportunityId: string }> };

function positiveId(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isSafeInteger(parsed) && Number(parsed) > 0 ? Number(parsed) : null;
}

function safeNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function GET(request: Request, context: Context) {
  const { id, opportunityId: rawOpportunityId } = await context.params;
  const workspaceId = positiveId(id);
  const opportunityId = positiveId(rawOpportunityId);
  if (!workspaceId || !opportunityId) {
    return NextResponse.json({ error: "Invalid workspace or opportunity id." }, { status: 400 });
  }

  const access = await getAgencyWorkspaceAccess(request, workspaceId);
  if (access.denied) return access.denied;

  const opportunityResult = await pool.query(
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
       c.email AS "clientEmail",
       c.phone AS "clientPhone"
     FROM agency_opportunities o
     JOIN agency_clients c ON c.id = o.client_id AND c.workspace_id = o.workspace_id
     WHERE o.id = $1 AND o.workspace_id = $2
     LIMIT 1`,
    [opportunityId, workspaceId],
  );
  const opportunity = opportunityResult.rows[0] as Record<string, unknown> | undefined;
  if (!opportunity) return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });

  const [intentsResult, suppliersResult, quotesResult, activitiesResult, storedSignalsResult, auditResult] = await Promise.all([
    pool.query(
      `SELECT id, revision, intent_snapshot AS intent, provenance, created_at AS "createdAt"
         FROM agency_intent_versions
        WHERE workspace_id = $1 AND opportunity_id = $2
        ORDER BY revision DESC
        LIMIT 20`,
      [workspaceId, opportunityId],
    ),
    pool.query(
      `SELECT
         id, category, supplier_name AS "supplierName", description, currency,
         cost_amount_minor AS "costAmountMinor", commission_expected_minor AS "commissionExpectedMinor",
         source_type AS "sourceType", source_ref AS "sourceRef", observed_at AS "observedAt",
         valid_until AS "validUntil", status, created_at AS "createdAt",
         CASE
           WHEN valid_until IS NOT NULL AND valid_until <= NOW() THEN 'stale'
           WHEN valid_until IS NOT NULL AND valid_until <= NOW() + INTERVAL '24 hours' THEN 'expiring'
           WHEN valid_until IS NOT NULL THEN 'fresh'
           ELSE 'unbounded'
         END AS freshness
       FROM agency_supplier_options
      WHERE workspace_id = $1 AND opportunity_id = $2
      ORDER BY created_at DESC
      LIMIT 50`,
      [workspaceId, opportunityId],
    ),
    pool.query(
      `SELECT
         q.id AS "quoteId", q.status,
         qv.id AS "quoteVersionId", qv.version, qv.intent_version_id AS "intentVersionId",
         qv.currency, qv.cost_total_minor AS "costTotalMinor", qv.sell_total_minor AS "sellTotalMinor",
         qv.commission_expected_minor AS "commissionExpectedMinor", qv.gross_profit_minor AS "grossProfitMinor",
         qv.margin_bps AS "marginBps", qv.markup_bps AS "markupBps", qv.lines_snapshot AS lines,
         qv.client_facing_terms AS "clientFacingTerms", qv.valid_until AS "validUntil",
         qv.integrity_digest AS "integrityDigest", qv.created_at AS "createdAt"
       FROM agency_quote_versions qv
       JOIN agency_quotes q
         ON q.id = qv.quote_id AND q.workspace_id = qv.workspace_id AND q.opportunity_id = qv.opportunity_id
      WHERE qv.workspace_id = $1 AND qv.opportunity_id = $2
      ORDER BY qv.created_at DESC, qv.version DESC
      LIMIT 30`,
      [workspaceId, opportunityId],
    ),
    pool.query(
      `SELECT
         id, quote_id AS "quoteId", quote_version_id AS "quoteVersionId",
         activity_type AS "activityType", channel, metadata,
         occurred_at AS "occurredAt"
       FROM agency_commercial_activities
      WHERE workspace_id = $1 AND opportunity_id = $2
      ORDER BY occurred_at DESC
      LIMIT 50`,
      [workspaceId, opportunityId],
    ),
    pool.query(
      `SELECT id, quote_version_id AS "quoteVersionId", signal_kind AS kind, severity,
              score, explanation, recommended_action AS "recommendedAction",
              model_name AS "modelName", created_at AS "createdAt"
         FROM agency_intelligence_signals
        WHERE workspace_id = $1 AND opportunity_id = $2
        ORDER BY created_at DESC
        LIMIT 30`,
      [workspaceId, opportunityId],
    ),
    pool.query(
      `SELECT id, event_type AS "eventType", payload, reference_type AS "referenceType",
              reference_id AS "referenceId", created_at AS "createdAt"
         FROM agency_domain_events
        WHERE workspace_id = $1
          AND (
            (reference_type = 'opportunity' AND reference_id = $2)
            OR payload->>'opportunityId' = $2::text
          )
        ORDER BY created_at DESC
        LIMIT 50`,
      [workspaceId, opportunityId],
    ),
  ]);

  const latestQuote = quotesResult.rows[0] as Record<string, unknown> | undefined;
  const latestActivity = activitiesResult.rows[0] as Record<string, unknown> | undefined;
  let liveSignals: ReturnType<typeof deriveCommercialSignals> = [];
  if (latestQuote) {
    const economics: QuoteEconomics | null = (() => {
      const costTotalMinor = safeNumber(latestQuote.costTotalMinor);
      const sellTotalMinor = safeNumber(latestQuote.sellTotalMinor);
      const commissionExpectedMinor = safeNumber(latestQuote.commissionExpectedMinor);
      const grossProfitMinor = safeNumber(latestQuote.grossProfitMinor);
      const marginBps = safeNumber(latestQuote.marginBps);
      const markupBps = safeNumber(latestQuote.markupBps);
      if ([costTotalMinor, sellTotalMinor, commissionExpectedMinor, grossProfitMinor, marginBps, markupBps].some((value) => value === null)) return null;
      return {
        currency: String(latestQuote.currency),
        costTotalMinor: costTotalMinor!,
        sellTotalMinor: sellTotalMinor!,
        commissionExpectedMinor: commissionExpectedMinor!,
        grossProfitMinor: grossProfitMinor!,
        marginBps: marginBps!,
        markupBps: markupBps!,
      };
    })();
    liveSignals = deriveCommercialSignals({
      stage: String(opportunity.stage) as OpportunityStage,
      economics,
      lastActivityAt: latestActivity?.occurredAt ? new Date(String(latestActivity.occurredAt)).toISOString() : null,
      quoteValidUntil: latestQuote.validUntil ? new Date(String(latestQuote.validUntil)).toISOString() : null,
    });
  }

  return NextResponse.json({
    opportunity,
    intentVersions: intentsResult.rows,
    supplierOptions: suppliersResult.rows,
    quoteVersions: quotesResult.rows,
    activities: activitiesResult.rows,
    intelligence: {
      live: liveSignals,
      recorded: storedSignalsResult.rows,
    },
    auditTrail: auditResult.rows,
  });
}

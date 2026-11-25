import { NextResponse } from "next/server";
import { pool } from "@/db";
import { getAgencyWorkspaceAccess } from "@/lib/agency-access";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

function positiveId(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isSafeInteger(parsed) && Number(parsed) > 0 ? Number(parsed) : null;
}

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  const workspaceId = positiveId(id);
  if (!workspaceId) return NextResponse.json({ error: "Invalid workspace id." }, { status: 400 });

  const access = await getAgencyWorkspaceAccess(request, workspaceId);
  if (access.denied) return access.denied;
  if (!access.workspace) return NextResponse.json({ error: "Agency workspace unavailable." }, { status: 403 });

  const [result, wonQuotedProfitResult] = await Promise.all([
    pool.query(
      `WITH opportunity_rollup AS (
         SELECT
           o.id,
           o.source,
           o.stage,
           o.created_at,
           o.won_quote_version_id,
           MIN(qv.created_at) AS first_quote_at
         FROM agency_opportunities o
         LEFT JOIN agency_quote_versions qv
           ON qv.workspace_id = o.workspace_id
          AND qv.opportunity_id = o.id
         WHERE o.workspace_id = $1
         GROUP BY o.id
       ),
       marketplace_inbox AS (
         SELECT cr.id, cr.created_at, ao.created_at AS adopted_at
           FROM contact_requests cr
           LEFT JOIN agency_opportunities ao
             ON ao.workspace_id = $1
            AND ao.source_contact_request_id = cr.id
          WHERE cr.request_kind = 'offer_inquiry'
            AND cr.agent_id = $2
         UNION ALL
         SELECT cr.id, cr.created_at, ao.created_at AS adopted_at
           FROM marketplace_request_recipients rr
           JOIN contact_requests cr
             ON cr.id = rr.contact_request_id
            AND cr.request_kind = 'open_request'
           LEFT JOIN agency_opportunities ao
             ON ao.id = rr.opportunity_id
            AND ao.workspace_id = rr.workspace_id
            AND ao.source_contact_request_id = cr.id
          WHERE rr.workspace_id = $1
            AND rr.agent_id = $2
       ),
       marketplace_rollup AS (
         SELECT
           COUNT(*)::int AS inquiries,
           COUNT(*) FILTER (WHERE adopted_at IS NULL)::int AS pending_inbox,
           COUNT(*) FILTER (WHERE adopted_at IS NOT NULL)::int AS adopted,
           AVG(EXTRACT(EPOCH FROM (adopted_at - created_at))) FILTER (WHERE adopted_at IS NOT NULL) AS avg_adoption_seconds
         FROM marketplace_inbox
       ),
       commercial_rollup AS (
         SELECT
           COUNT(*)::int AS opportunities,
           COUNT(*) FILTER (WHERE stage NOT IN ('won','lost','cancelled'))::int AS open_opportunities,
           COUNT(*) FILTER (WHERE stage = 'won')::int AS won,
           COUNT(*) FILTER (WHERE stage = 'lost')::int AS lost,
           COUNT(*) FILTER (WHERE first_quote_at IS NOT NULL)::int AS quoted,
           AVG(EXTRACT(EPOCH FROM (first_quote_at - created_at))) FILTER (WHERE first_quote_at IS NOT NULL) AS avg_quote_seconds
         FROM opportunity_rollup
       ),
       economics AS (
         SELECT
           CASE
             WHEN COUNT(*) FILTER (WHERE o.stage = 'won' AND qv.sell_total_minor > 0) = 0 THEN NULL
             ELSE ROUND(AVG(qv.margin_bps) FILTER (WHERE o.stage = 'won' AND qv.sell_total_minor > 0))::int
           END AS avg_won_margin_bps
         FROM agency_opportunities o
         LEFT JOIN agency_quote_versions qv
           ON qv.id = o.won_quote_version_id
          AND qv.workspace_id = o.workspace_id
          AND qv.opportunity_id = o.id
         WHERE o.workspace_id = $1
       ),
       supply AS (
         SELECT
           COUNT(*) FILTER (
             WHERE status IN ('active','selected')
               AND valid_until IS NOT NULL
               AND valid_until <= NOW()
           )::int AS stale_active_options,
           COUNT(*) FILTER (
             WHERE status IN ('active','selected')
               AND valid_until IS NOT NULL
               AND valid_until > NOW()
               AND valid_until <= NOW() + INTERVAL '24 hours'
           )::int AS expiring_options
         FROM agency_supplier_options
         WHERE workspace_id = $1
       )
       SELECT
         m.inquiries AS "marketplaceInquiries",
         m.pending_inbox AS "pendingInbox",
         m.adopted AS "adoptedMarketplace",
         m.avg_adoption_seconds AS "avgAdoptionSeconds",
         c.opportunities,
         c.open_opportunities AS "openOpportunities",
         c.won,
         c.lost,
         c.quoted,
         c.avg_quote_seconds AS "avgQuoteSeconds",
         e.avg_won_margin_bps AS "avgWonMarginBps",
         s.stale_active_options AS "staleActiveOptions",
         s.expiring_options AS "expiringOptions"
       FROM marketplace_rollup m
       CROSS JOIN commercial_rollup c
       CROSS JOIN economics e
       CROSS JOIN supply s`,
      [workspaceId, access.workspace.agentId],
    ),
    pool.query(
      `SELECT qv.currency, SUM(qv.gross_profit_minor)::bigint AS gross_profit_minor
         FROM agency_opportunities o
         JOIN agency_quote_versions qv
           ON qv.id = o.won_quote_version_id
          AND qv.workspace_id = o.workspace_id
          AND qv.opportunity_id = o.id
        WHERE o.workspace_id = $1 AND o.stage = 'won'
        GROUP BY qv.currency
        ORDER BY qv.currency`,
      [workspaceId],
    ),
  ]);

  const row = result.rows[0] ?? {};
  const closed = Number(row.won ?? 0) + Number(row.lost ?? 0);
  const inquiries = Number(row.marketplaceInquiries ?? 0);
  const opportunities = Number(row.opportunities ?? 0);
  const wonQuotedGrossProfit = wonQuotedProfitResult.rows.map((entry) => ({
    currency: String(entry.currency),
    grossProfitMinor: Number(entry.gross_profit_minor),
  }));

  return NextResponse.json({
    metrics: {
      ...row,
      wonQuotedGrossProfit,
      inquiryAdoptionRate: inquiries > 0 ? Number(row.adoptedMarketplace ?? 0) / inquiries : null,
      quoteRate: opportunities > 0 ? Number(row.quoted ?? 0) / opportunities : null,
      winRate: closed > 0 ? Number(row.won ?? 0) / closed : null,
    },
    economicsBasis: "immutable_winning_quote_versions_not_realized_settlement",
    basis: "canonical_commercial_records",
    generatedAt: new Date().toISOString(),
  });
}

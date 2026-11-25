import { NextResponse } from "next/server";
import { pool } from "@/db";
import { getAgencyWorkspaceAccess } from "@/lib/agency-access";
import { executeCommercialCommand } from "@/lib/commercial-service";
import { buildMarketplaceInquiryIntent } from "@/lib/agency-linked-intent";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

type InquiryRow = {
  id: number;
  traveler_name: string;
  traveler_count: number;
  travel_dates: string | null;
  message: string;
  created_at: Date;
  status: string;
  offer_id: number;
  offer_title: string;
  origin_city: string;
  destination_city: string;
  trip_type: string;
  departure_date: Date | null;
  duration_days: number | null;
  opportunity_id: number | null;
  saved_intent_id: number | null;
  saved_intent_snapshot: unknown | null;
};

function positiveId(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isSafeInteger(parsed) && Number(parsed) > 0 ? Number(parsed) : null;
}

function dateOnly(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

async function loadInquiry(workspaceId: number, agentId: number, inquiryId: number): Promise<InquiryRow | null> {
  const result = await pool.query<InquiryRow>(
    `SELECT
       cr.id,
       cr.traveler_name,
       cr.traveler_count,
       cr.travel_dates,
       cr.message,
       cr.created_at,
       cr.status,
       o.id AS offer_id,
       o.title AS offer_title,
       o.origin_city,
       o.destination_city,
       o.trip_type,
       o.departure_date,
       o.duration_days,
       ao.id AS opportunity_id
     FROM contact_requests cr
     JOIN offers o ON o.id = cr.offer_id AND o.agent_id = cr.agent_id
     LEFT JOIN agency_opportunities ao
       ON ao.workspace_id = $1
      AND ao.source_contact_request_id = cr.id
     WHERE cr.id = $2 AND cr.agent_id = $3
     LIMIT 1`,
    [workspaceId, inquiryId, agentId],
  );
  const row = result.rows[0] ?? null;
  if (!row || process.env.TRAVELER_WORKSPACE_ENABLED !== "true") return row;

  // Query the Saved Intent only when the traveler workspace has been migrated
  // and enabled. Ownership is rechecked against contact_requests.traveler_account_id.
  const linked = await pool.query<{ id: number; intent_snapshot: unknown }>(
    `SELECT tsi.id, tsi.intent_snapshot
       FROM traveler_intent_inquiries tii
       JOIN traveler_saved_intents tsi
         ON tsi.id = tii.saved_intent_id
        AND tsi.account_id = (
          SELECT traveler_account_id FROM contact_requests WHERE id = $1
        )
      WHERE tii.contact_request_id = $1
      LIMIT 1`,
    [inquiryId],
  );
  row.saved_intent_id = linked.rows[0]?.id ?? null;
  row.saved_intent_snapshot = linked.rows[0]?.intent_snapshot ?? null;
  return row;
}

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  const workspaceId = positiveId(id);
  if (!workspaceId) return NextResponse.json({ error: "Invalid workspace id." }, { status: 400 });

  const access = await getAgencyWorkspaceAccess(request, workspaceId);
  if (access.denied) return access.denied;
  if (!access.workspace) return NextResponse.json({ error: "Agency workspace unavailable." }, { status: 403 });

  const result = await pool.query(
    `SELECT
       cr.id,
       cr.traveler_name AS "travelerName",
       cr.traveler_count AS "travelerCount",
       cr.travel_dates AS "travelDates",
       cr.message,
       cr.status,
       cr.created_at AS "createdAt",
       o.id AS "offerId",
       o.title AS "offerTitle",
       o.origin_city AS "originCity",
       o.destination_city AS "destinationCity",
       o.trip_type AS "tripType",
       o.departure_date AS "departureDate",
       o.duration_days AS "durationDays",
       ao.id AS "opportunityId"
     FROM contact_requests cr
     JOIN offers o ON o.id = cr.offer_id AND o.agent_id = cr.agent_id
     LEFT JOIN agency_opportunities ao
       ON ao.workspace_id = $1
      AND ao.source_contact_request_id = cr.id
     WHERE cr.agent_id = $2
     ORDER BY (ao.id IS NULL) DESC, cr.created_at DESC
     LIMIT 50`,
    [workspaceId, access.workspace.agentId],
  );

  return NextResponse.json({ inquiries: result.rows });
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const inquiryId = positiveId((body as { inquiryId?: unknown } | null)?.inquiryId);
  if (!inquiryId) return NextResponse.json({ error: "inquiryId is required." }, { status: 422 });

  const inquiry = await loadInquiry(workspaceId, access.workspace.agentId, inquiryId);
  if (!inquiry) return NextResponse.json({ error: "Marketplace inquiry not found for this agency." }, { status: 404 });
  if (inquiry.opportunity_id) {
    return NextResponse.json(
      { error: "This marketplace inquiry is already linked to an opportunity.", opportunityId: inquiry.opportunity_id },
      { status: 409 },
    );
  }

  const departureDate = dateOnly(inquiry.departure_date);
  const projectedIntent = buildMarketplaceInquiryIntent(
    inquiry.saved_intent_snapshot,
    {
      originCity: inquiry.origin_city,
      destinationCity: inquiry.destination_city,
      departureDate,
      durationDays: inquiry.duration_days,
      tripType: inquiry.trip_type,
      travelerCount: inquiry.traveler_count,
      travelDates: inquiry.travel_dates,
    },
  );
  if (!projectedIntent.ok) {
    return NextResponse.json({ error: projectedIntent.error }, { status: 422 });
  }

  const result = await executeCommercialCommand({
    workspaceId,
    agentId: access.workspace.agentId,
    accountId: access.account.id,
    membershipRole: access.membership.role as "owner" | "member",
  }, {
    command: "create_opportunity",
    source: "marketplace",
    sourceContactRequestId: inquiry.id,
    title: `${inquiry.offer_title} — ${inquiry.traveler_name}`,
    intent: projectedIntent.value,
  });

  return NextResponse.json(result.body, { status: result.status });
}

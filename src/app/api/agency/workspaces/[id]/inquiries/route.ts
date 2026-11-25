import { NextResponse } from "next/server";
import { pool } from "@/db";
import { getAgencyWorkspaceAccess } from "@/lib/agency-access";
import { executeCommercialCommand } from "@/lib/commercial-service";
import { buildMarketplaceInquiryIntent } from "@/lib/agency-linked-intent";
import { parseTravelerIntent } from "@/lib/commercial-domain";
import { notify } from "@/lib/notify";
import { randomUUID } from "node:crypto";

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

function addDays(date: string | null, durationDays: number | null): string | null {
  if (!date || !durationDays || durationDays < 1) return null;
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + Math.max(0, durationDays - 1));
  return result.toISOString().slice(0, 10);
}

type OpenInquiryRow = {
  id: number;
  traveler_count: number;
  travel_dates: string | null;
  message: string;
  created_at: Date;
  request_snapshot: unknown;
  recipient_id: number;
  recipient_status: string;
  opportunity_id: number | null;
  matching_reason: string;
};

async function loadOpenInquiry(workspaceId: number, agentId: number, inquiryId: number): Promise<OpenInquiryRow | null> {
  if (process.env.MULTI_PROVIDER_REQUESTS_ENABLED !== "true") return null;
  const result = await pool.query<OpenInquiryRow>(
    `SELECT cr.id, cr.traveler_count, cr.travel_dates, cr.message, cr.created_at,
            cr.request_snapshot, rr.id AS recipient_id, rr.status AS recipient_status,
            rr.opportunity_id, rr.matching_reason
       FROM contact_requests cr
       JOIN marketplace_request_recipients rr
         ON rr.contact_request_id = cr.id
        AND rr.workspace_id = $1
        AND rr.agent_id = $2
      WHERE cr.id = $3
        AND cr.request_kind = 'open_request'
      LIMIT 1`,
    [workspaceId, agentId, inquiryId],
  );
  return result.rows[0] ?? null;
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

  const legacy = await pool.query(
    `SELECT
       cr.id,
       cr.traveler_name AS "travelerName",
       cr.traveler_count AS "travelerCount",
       cr.travel_dates AS "travelDates",
       cr.message,
       cr.status,
       cr.created_at AS "createdAt",
       cr.offer_id AS "offerId",
       o.title AS "offerTitle",
       o.origin_city AS "originCity",
       o.destination_city AS "destinationCity",
       o.trip_type AS "tripType",
       o.departure_date AS "departureDate",
       o.duration_days AS "durationDays",
       ao.id AS "opportunityId",
       'offer_inquiry' AS "requestKind"
     FROM contact_requests cr
     JOIN offers o ON o.id = cr.offer_id AND o.agent_id = cr.agent_id
     LEFT JOIN agency_opportunities ao
       ON ao.workspace_id = $1
      AND ao.source_contact_request_id = cr.id
     WHERE cr.request_kind = 'offer_inquiry'
       AND cr.agent_id = $2
     ORDER BY (ao.id IS NULL) DESC, cr.created_at DESC
     LIMIT 50`,
    [workspaceId, access.workspace.agentId],
  );

  const open = process.env.MULTI_PROVIDER_REQUESTS_ENABLED === "true"
    ? await pool.query(
        `SELECT cr.id,
                cr.traveler_count AS "travelerCount",
                cr.travel_dates AS "travelDates",
                cr.request_snapshot AS "requestSnapshot",
                cr.created_at AS "createdAt",
                rr.status AS "recipientStatus",
                rr.matching_reason AS "matchingReason",
                ao.id AS "opportunityId"
           FROM marketplace_request_recipients rr
           JOIN contact_requests cr ON cr.id = rr.contact_request_id
           LEFT JOIN agency_opportunities ao
             ON ao.id = rr.opportunity_id
            AND ao.workspace_id = rr.workspace_id
            AND ao.source_contact_request_id = cr.id
          WHERE rr.workspace_id = $1
            AND rr.agent_id = $2
            AND rr.status IN ('sent','viewed','accepted')
            AND cr.request_kind = 'open_request'
          ORDER BY cr.created_at DESC
          LIMIT 50`,
        [workspaceId, access.workspace.agentId],
      )
    : { rows: [] as Array<Record<string, unknown>> };

  const openInquiries = open.rows.map((row) => {
    const snapshot = row.requestSnapshot && typeof row.requestSnapshot === "object" && !Array.isArray(row.requestSnapshot)
      ? row.requestSnapshot as Record<string, unknown>
      : {};
    const intent = snapshot.intent && typeof snapshot.intent === "object" && !Array.isArray(snapshot.intent)
      ? snapshot.intent as Record<string, unknown>
      : {};
    const destinations = Array.isArray(intent.destinations)
      ? intent.destinations.filter((item): item is string => typeof item === "string")
      : [];
    const travelers = intent.travelers && typeof intent.travelers === "object" && !Array.isArray(intent.travelers)
      ? intent.travelers as Record<string, unknown>
      : {};
    const ref = `TRQ-${String(row.id).padStart(5, "0")}`;
    return {
      id: row.id,
      reference: ref,
      requestKind: "open_request",
      travelerName: `مسافر صلة · ${ref}`,
      travelerCount: row.travelerCount,
      travelDates: row.travelDates,
      message: typeof intent.notes === "string" ? intent.notes : "",
      status: "new",
      createdAt: row.createdAt,
      offerId: null,
      offerTitle: snapshot.categoryLabel ?? "طلب سوق مفتوح",
      originCity: typeof intent.originCity === "string" ? intent.originCity : null,
      destinationCity: destinations.join("، "),
      tripType: snapshot.category ?? null,
      departureDate: typeof intent.departureDate === "string" ? intent.departureDate : null,
      durationDays: null,
      opportunityId: row.opportunityId,
      recipientStatus: row.recipientStatus,
      matchingReason: row.matchingReason,
      requestSnapshot: snapshot,
      travelers,
      budget: {
        amountMinor: intent.budgetAmountMinor ?? null,
        currency: intent.budgetCurrency ?? null,
        basis: intent.budgetBasis ?? null,
      },
      priorities: Array.isArray(intent.priorities) ? intent.priorities : [],
      constraints: Array.isArray(intent.constraints) ? intent.constraints : [],
    };
  });

  return NextResponse.json({
    inquiries: [...legacy.rows, ...openInquiries],
    counts: {
      offerInquiries: legacy.rows.length,
      openRequests: openInquiries.length,
    },
  }, { headers: { "cache-control": "no-store" } });
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
  const payload = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const inquiryId = positiveId(payload.inquiryId);
  if (!inquiryId) return NextResponse.json({ error: "inquiryId is required." }, { status: 422 });

  const action = payload.action === "decline" ? "decline" : "adopt";

  if (process.env.MULTI_PROVIDER_REQUESTS_ENABLED === "true") {
    const openInquiry = await loadOpenInquiry(workspaceId, access.workspace.agentId, inquiryId);
    if (openInquiry) {
      if (action === "decline") {
        if (!["sent", "viewed"].includes(openInquiry.recipient_status)) {
          return NextResponse.json({ error: "لم يعد هذا الطلب متاحًا لاتخاذ قرار جديد." }, { status: 409 });
        }
        const declined = await pool.query(
          `UPDATE marketplace_request_recipients
              SET status = 'declined', responded_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND workspace_id = $2 AND status IN ('sent','viewed')
            RETURNING id`,
          [openInquiry.recipient_id, workspaceId],
        );
        if (declined.rowCount !== 1) {
          return NextResponse.json({ error: "تم تحديث حالة الطلب في جلسة أخرى. حدّث صندوق الطلبات." }, { status: 409 });
        }
        await pool.query(
          `INSERT INTO agency_domain_events
            (workspace_id, actor_account_id, event_type, payload, reference_type, reference_id, correlation_id)
           VALUES ($1,$2,'marketplace.request_declined',$3::jsonb,'contact_request',$4,$5)`,
          [workspaceId, access.account.id, JSON.stringify({ requestKind: "open_request" }), inquiryId, randomUUID()],
        );
        await notify({
          accountId: Number((await pool.query<{ traveler_account_id: number }>(
            "SELECT traveler_account_id FROM contact_requests WHERE id = $1",
            [inquiryId],
          )).rows[0]?.traveler_account_id),
          type: "marketplace_request_declined",
          title: "تحديث على طلب السفر",
          body: `إحدى الجهات التي استلمت طلب TRQ-${String(inquiryId).padStart(5, "0")} اعتذرت عن تقديم عرض.`,
          link: "/account/travel",
          targetId: inquiryId,
          dedupeScope: `marketplace-declined:${workspaceId}:${inquiryId}`,
        });
        return NextResponse.json({ declined: true, inquiryId }, { status: 200 });
      }

      if (openInquiry.recipient_status === "accepted" && openInquiry.opportunity_id) {
        return NextResponse.json({ opportunityId: openInquiry.opportunity_id, existing: true }, { status: 200 });
      }
      if (!["sent", "viewed"].includes(openInquiry.recipient_status)) {
        return NextResponse.json({ error: "هذا الطلب لم يعد متاحًا للتبني." }, { status: 409 });
      }
      const snapshot = openInquiry.request_snapshot && typeof openInquiry.request_snapshot === "object" && !Array.isArray(openInquiry.request_snapshot)
        ? openInquiry.request_snapshot as Record<string, unknown>
        : {};
      const projectedIntent = parseTravelerIntent(snapshot.intent);
      if (!projectedIntent.ok) {
        return NextResponse.json({ error: "تفاصيل طلب المسافر غير مكتملة ولا يمكن تبنيها بأمان." }, { status: 422 });
      }
      const categoryLabel = typeof snapshot.categoryLabel === "string" ? snapshot.categoryLabel : "طلب خدمة";
      const destinations = projectedIntent.value.destinations.join("، ");
      const result = await executeCommercialCommand({
        workspaceId,
        agentId: access.workspace.agentId,
        accountId: access.account.id,
        membershipRole: access.membership.role as "owner" | "member",
      }, {
        command: "create_opportunity",
        source: "marketplace",
        sourceContactRequestId: inquiryId,
        title: `${categoryLabel} — ${destinations}`,
        intent: projectedIntent.value,
      });
      return NextResponse.json(result.body, { status: result.status });
    }
  }

  if (action === "decline") {
    return NextResponse.json({ error: "الاعتذار متاح فقط لطلبات السوق المفتوحة." }, { status: 422 });
  }

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
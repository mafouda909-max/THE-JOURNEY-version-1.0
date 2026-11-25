import { NextResponse } from "next/server";
import { pool } from "@/db";
import { getAgencyWorkspaceAccess } from "@/lib/agency-access";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; opportunityId: string }> };
type Json = Record<string, unknown>;

const CHANNELS = new Set(["phone", "whatsapp", "email", "in_person", "other"]);

function positiveId(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isSafeInteger(parsed) && Number(parsed) > 0 ? Number(parsed) : null;
}

async function parseBody(request: Request): Promise<Json | null> {
  try {
    const value: unknown = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Json : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request, context: Context) {
  if (process.env.DIRECT_CONFIRMATION_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id, opportunityId: rawOpportunityId } = await context.params;
  const workspaceId = positiveId(id);
  const opportunityId = positiveId(rawOpportunityId);
  if (!workspaceId || !opportunityId) {
    return NextResponse.json({ error: "Invalid workspace or opportunity id." }, { status: 400 });
  }

  const access = await getAgencyWorkspaceAccess(request, workspaceId);
  if (access.denied) return access.denied;
  if (!access.workspace || !access.membership) {
    return NextResponse.json({ error: "Agency access unavailable." }, { status: 403 });
  }

  const result = await pool.query(
    `SELECT d.id AS "deliveryId", d.response, d.responded_at AS "travelerRespondedAt",
            qv.id AS "quoteVersionId", qv.version,
            dc.id AS "confirmationId", dc.provider_name AS "providerName",
            dc.confirmation_channel AS channel, dc.confirmation_note AS note,
            dc.reported_at AS "reportedAt", dc.traveler_response AS "travelerResponse",
            dc.traveler_response_note AS "travelerResponseNote",
            dc.traveler_responded_at AS "travelerAcknowledgedAt"
       FROM agency_quote_deliveries d
       JOIN agency_quote_versions qv
         ON qv.id = d.quote_version_id
        AND qv.workspace_id = d.workspace_id
        AND qv.opportunity_id = d.opportunity_id
       LEFT JOIN agency_direct_confirmations dc ON dc.delivery_id = d.id
      WHERE d.workspace_id = $1
        AND d.opportunity_id = $2
        AND d.status = 'responded'
        AND d.response = 'approved'
      ORDER BY d.responded_at DESC, d.id DESC
      LIMIT 20`,
    [workspaceId, opportunityId],
  );

  return NextResponse.json({ deliveries: result.rows }, {
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: Request, context: Context) {
  if (process.env.DIRECT_CONFIRMATION_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id, opportunityId: rawOpportunityId } = await context.params;
  const workspaceId = positiveId(id);
  const opportunityId = positiveId(rawOpportunityId);
  if (!workspaceId || !opportunityId) {
    return NextResponse.json({ error: "Invalid workspace or opportunity id." }, { status: 400 });
  }

  const access = await getAgencyWorkspaceAccess(request, workspaceId);
  if (access.denied) return access.denied;
  if (!access.account || !access.workspace || !access.membership) {
    return NextResponse.json({ error: "Agency access unavailable." }, { status: 403 });
  }

  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const deliveryId = positiveId(body.deliveryId);
  const providerName = typeof body.providerName === "string" ? body.providerName.trim() : "";
  const channel = typeof body.channel === "string" ? body.channel : "";
  const note = body.note == null || body.note === "" ? null : typeof body.note === "string" ? body.note.trim() : null;

  if (!deliveryId) return NextResponse.json({ error: "اختر نسخة العرض التي وافق عليها المسافر." }, { status: 422 });
  if (providerName.length < 2 || providerName.length > 160) {
    return NextResponse.json({ error: "اكتب اسم مقدم الخدمة (من حرفين إلى 160 حرفًا)." }, { status: 422 });
  }
  if (!CHANNELS.has(channel)) {
    return NextResponse.json({ error: "طريقة التواصل المباشر غير صحيحة." }, { status: 422 });
  }
  if (body.note != null && body.note !== "" && (typeof body.note !== "string" || !note || note.length > 500)) {
    return NextResponse.json({ error: "الملخص الاختياري طويل جدًا أو غير صحيح." }, { status: 422 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const deliveryResult = await client.query(
      `SELECT d.id, d.workspace_id, d.opportunity_id, d.quote_id, d.quote_version_id,
              d.status, d.response, qv.version
         FROM agency_quote_deliveries d
         JOIN agency_quote_versions qv
           ON qv.id = d.quote_version_id
          AND qv.workspace_id = d.workspace_id
          AND qv.opportunity_id = d.opportunity_id
        WHERE d.id = $1 AND d.workspace_id = $2 AND d.opportunity_id = $3
        LIMIT 1
        FOR UPDATE OF d`,
      [deliveryId, workspaceId, opportunityId],
    );
    const delivery = deliveryResult.rows[0] as Record<string, unknown> | undefined;
    if (!delivery) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "نسخة العرض غير موجودة في مساحة الوكالة." }, { status: 404 });
    }
    if (delivery.status !== "responded" || delivery.response !== "approved") {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "لا يمكن تسجيل التأكيد قبل موافقة المسافر على نسخة العرض." }, { status: 409 });
    }

    const inserted = await client.query(
      `INSERT INTO agency_direct_confirmations
        (workspace_id, opportunity_id, quote_id, quote_version_id, delivery_id,
         provider_name, confirmation_channel, confirmation_note, reported_by_account_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (delivery_id) DO NOTHING
       RETURNING id, provider_name AS "providerName", confirmation_channel AS channel,
                 confirmation_note AS note, reported_at AS "reportedAt"`,
      [workspaceId, opportunityId, Number(delivery.quote_id), Number(delivery.quote_version_id),
       deliveryId, providerName, channel, note, access.account.id],
    );
    const confirmation = inserted.rows[0] as Record<string, unknown> | undefined;
    if (!confirmation) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "تم تسجيل التأكيد لهذه النسخة بالفعل." }, { status: 409 });
    }

    await client.query(
      `INSERT INTO agency_domain_events
        (workspace_id, actor_account_id, event_type, payload, reference_type, reference_id, correlation_id)
       VALUES ($1,$2,'quote.direct_confirmation_reported',$3::jsonb,'direct_confirmation',$4,$5)`,
      [
        workspaceId,
        access.account.id,
        JSON.stringify({ deliveryId, quoteVersionId: Number(delivery.quote_version_id), channel, messageCaptured: Boolean(note) }),
        Number(confirmation.id),
        crypto.randomUUID(),
      ],
    );

    await client.query(
      `INSERT INTO notifications (account_id, type, title, body, link, idempotency_key)
       SELECT cr.traveler_account_id, 'service_confirmation',
              'تأكيد مباشر مسجل من الوكالة',
              'سجلت الوكالة تواصلًا مباشرًا مع مقدم الخدمة. راجع صفحة العرض لمعرفة ما تم تسجيله.',
              '/account/travel',
              'direct-confirmation:' || $1::text
         FROM agency_opportunities ao
         JOIN contact_requests cr ON cr.id = ao.source_contact_request_id
        WHERE ao.id = $2 AND ao.workspace_id = $3
          AND cr.traveler_account_id IS NOT NULL
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [Number(confirmation.id), opportunityId, workspaceId],
    );

    await client.query("COMMIT");
    return NextResponse.json({
      confirmation: {
        id: Number(confirmation.id),
        deliveryId,
        quoteVersion: Number(delivery.version),
        providerName: confirmation.providerName,
        channel: confirmation.channel,
        note: confirmation.note,
        reportedAt: confirmation.reportedAt,
        travelerResponse: null,
        travelerAcknowledgedAt: null,
      },
    }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* transaction may already be closed */ }
    const code = (error as { code?: string }).code;
    if (code === "23514") {
      return NextResponse.json({ error: "رفضت قاعدة البيانات التأكيد لأن حالة العرض أو مرجعه غير متوافق." }, { status: 409 });
    }
    console.error("Direct confirmation report failed", code ?? "unknown");
    return NextResponse.json({ error: "تعذر حفظ التأكيد المباشر بأمان." }, { status: 500 });
  } finally {
    client.release();
  }
}

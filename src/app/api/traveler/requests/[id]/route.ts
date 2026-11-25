import { NextResponse } from "next/server";
import { pool } from "@/db";
import { accountFromRequest } from "@/lib/identity";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
type Row = Record<string, unknown>;

function positiveId(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isSafeInteger(parsed) && Number(parsed) > 0 ? Number(parsed) : null;
}

function publicQuoteLines(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const line = raw as Record<string, unknown>;
    const label = typeof line.label === "string" ? line.label.trim().slice(0, 240) : "";
    const kind = typeof line.kind === "string" ? line.kind : "";
    const currency = typeof line.currency === "string" ? line.currency : "";
    const quantity = Number(line.quantity);
    const sellUnitMinor = Number(line.sellUnitMinor);
    const lineTotalMinor = quantity * sellUnitMinor;
    if (!label || !kind || !/^[A-Z]{3}$/.test(currency) ||
        !Number.isSafeInteger(quantity) || quantity < 1 ||
        !Number.isSafeInteger(sellUnitMinor) || sellUnitMinor < 0 ||
        !Number.isSafeInteger(lineTotalMinor)) return [];
    return [{ kind, label, quantity, currency, sellUnitMinor, lineTotalMinor }];
  });
}

export async function GET(request: Request, context: Context) {
  if (process.env.MULTI_PROVIDER_REQUESTS_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const account = await accountFromRequest(request);
  if (!account || account.role !== "traveler") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestId = positiveId((await context.params).id);
  if (!requestId) return NextResponse.json({ error: "Invalid request id." }, { status: 400 });

  const root = await pool.query(
    `SELECT id, request_snapshot, status, created_at AS "createdAt"
       FROM contact_requests
      WHERE id = $1
        AND traveler_account_id = $2
        AND request_kind = 'open_request'
      LIMIT 1`,
    [requestId, account.id],
  );
  const requestRow = root.rows[0] as Row | undefined;
  if (!requestRow) return NextResponse.json({ error: "الطلب غير موجود في حسابك." }, { status: 404 });

  const recipients = await pool.query(
    `SELECT rr.workspace_id AS "workspaceId",
            rr.status AS "recipientStatus",
            rr.matching_reason AS "matchingReason",
            rr.opportunity_id AS "opportunityId",
            rr.sent_at AS "sentAt",
            rr.responded_at AS "respondedAt",
            w.name AS "workspaceName",
            a.display_name AS "providerName",
            a.city AS "providerCity",
            a.country AS "providerCountry"
       FROM marketplace_request_recipients rr
       JOIN agency_workspaces w ON w.id = rr.workspace_id
       JOIN agents a ON a.id = rr.agent_id
      WHERE rr.contact_request_id = $1
      ORDER BY rr.sent_at ASC, rr.id ASC`,
    [requestId],
  );

  const quotes = await pool.query(
    `SELECT rr.workspace_id AS "workspaceId",
            qd.id AS "deliveryId",
            qd.status AS "deliveryStatus",
            qd.response,
            qd.response_message AS "responseMessage",
            qd.responded_at AS "respondedAt",
            qd.expires_at AS "deliveryExpiresAt",
            qv.version,
            qv.currency,
            qv.sell_total_minor AS "sellTotalMinor",
            qv.lines_snapshot AS "linesSnapshot",
            qv.client_facing_terms AS "clientFacingTerms",
            qv.valid_until AS "validUntil",
            qv.created_at AS "createdAt"
       FROM marketplace_request_recipients rr
       JOIN agency_opportunities ao
         ON ao.id = rr.opportunity_id
        AND ao.workspace_id = rr.workspace_id
        AND ao.source_contact_request_id = rr.contact_request_id
       JOIN agency_quote_deliveries qd
         ON qd.workspace_id = ao.workspace_id
        AND qd.opportunity_id = ao.id
        AND qd.status IN ('active','responded','expired')
       JOIN agency_quote_versions qv
         ON qv.id = qd.quote_version_id
        AND qv.workspace_id = qd.workspace_id
        AND qv.opportunity_id = qd.opportunity_id
      WHERE rr.contact_request_id = $1
        AND rr.status = 'accepted'
      ORDER BY qd.created_at DESC, qd.id DESC`,
    [requestId],
  );

  const snapshot = requestRow.request_snapshot && typeof requestRow.request_snapshot === "object" && !Array.isArray(requestRow.request_snapshot)
    ? requestRow.request_snapshot as Row
    : {};
  const providers = (recipients.rows as Row[]).map((row) => ({
    workspaceId: Number(row.workspaceId),
    name: row.providerName,
    city: row.providerCity,
    country: row.providerCountry,
    status: row.recipientStatus,
    sentAt: row.sentAt,
    respondedAt: row.respondedAt,
    opportunityId: row.opportunityId == null ? null : Number(row.opportunityId),
    quotes: [] as Array<Record<string, unknown>>,
  }));
  const byWorkspace = new Map(providers.map((provider) => [provider.workspaceId, provider]));
  for (const row of quotes.rows as Row[]) {
    const provider = byWorkspace.get(Number(row.workspaceId));
    if (!provider) continue;
    const status = String(row.deliveryStatus);
    const expiresAt = row.deliveryExpiresAt instanceof Date
      ? row.deliveryExpiresAt.toISOString()
      : new Date(String(row.deliveryExpiresAt)).toISOString();
    provider.quotes.push({
      deliveryId: Number(row.deliveryId),
      status: status === "active" && new Date(expiresAt).getTime() <= Date.now() ? "expired" : status,
      response: row.response ?? null,
      responseMessage: row.responseMessage ?? null,
      respondedAt: row.respondedAt ?? null,
      version: Number(row.version),
      currency: String(row.currency),
      sellTotalMinor: Number(row.sellTotalMinor),
      lines: publicQuoteLines(row.linesSnapshot),
      clientFacingTerms: typeof row.clientFacingTerms === "string" ? row.clientFacingTerms : null,
      validUntil: row.validUntil,
      deliveryExpiresAt: expiresAt,
      createdAt: row.createdAt,
    });
  }

  return NextResponse.json({
    request: {
      id: requestId,
      reference: `TRQ-${String(requestId).padStart(5, "0")}`,
      status: requestRow.status,
      category: snapshot.category ?? null,
      categoryLabel: snapshot.categoryLabel ?? null,
      intent: snapshot.intent ?? null,
      createdAt: requestRow.createdAt,
      providerCount: providers.length,
    },
    providers,
  }, { headers: { "cache-control": "no-store" } });
}

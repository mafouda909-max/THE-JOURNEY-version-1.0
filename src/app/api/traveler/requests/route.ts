import { NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, pool } from "@/db";
import { agencyMemberships, agencyWorkspaces, agents, contactRequests, travelerIntentInquiries, travelerSavedIntents } from "@/db/schema";
import { accountFromRequest } from "@/lib/identity";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";
import { notify } from "@/lib/notify";
import { evaluatePublicAgentTrust } from "@/lib/public-agent";
import { loadPublicAgentEvidence } from "@/lib/public-agent-evidence";
import { parseTravelerIntent, type TravelerIntent } from "@/lib/commercial-domain";
import {
  MARKETPLACE_REQUEST_CATEGORY_LABELS,
  MARKETPLACE_REQUEST_CATEGORIES,
  MARKETPLACE_REQUEST_RECIPIENT_LIMIT,
  providerMatchesMarketplaceCategory,
  rankMarketplaceRecipients,
  type MarketplaceRequestCategory,
} from "@/lib/marketplace-request-matching";

export const dynamic = "force-dynamic";

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function positiveId(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isSafeInteger(parsed) && Number(parsed) > 0 ? Number(parsed) : null;
}

function isCategory(value: unknown): value is MarketplaceRequestCategory {
  return typeof value === "string" && MARKETPLACE_REQUEST_CATEGORIES.includes(value as MarketplaceRequestCategory);
}

function travelerCount(intent: TravelerIntent): number {
  return intent.travelers.adults + intent.travelers.children + intent.travelers.infants;
}

export async function POST(request: Request) {
  if (process.env.MULTI_PROVIDER_REQUESTS_ENABLED !== "true") {
    return NextResponse.json({ error: "طلبات السوق المفتوحة غير مفعلة في هذه البيئة." }, { status: 404 });
  }

  const account = await accountFromRequest(request);
  if (!account || account.role !== "traveler") {
    return NextResponse.json({ error: "سجّل الدخول بحساب مسافر لإنشاء طلب سوق." }, { status: 401 });
  }

  const accountLimit = rateLimiter.checkRateLimit(`marketplace:open-request:account:${account.id}`, 3, 3600);
  const ipLimit = rateLimiter.checkRateLimit(`marketplace:open-request:ip:${clientIpFromRequest(request)}`, 8, 3600);
  if (!accountLimit.allowed || !ipLimit.allowed) {
    const resetSeconds = Math.max(accountLimit.resetSeconds, ipLimit.resetSeconds);
    return NextResponse.json(
      { error: "تم الوصول إلى الحد المؤقت لإنشاء طلبات جديدة. راجع طلباتك الحالية وحاول لاحقًا." },
      { status: 429, headers: { "Retry-After": String(resetSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات الطلب غير صالحة." }, { status: 400 });
  }
  if (!isRecord(body) || !isCategory(body.category)) {
    return NextResponse.json({ error: "اختر نوع خدمة صحيحًا." }, { status: 422 });
  }
  if (body.shareWithProviders !== true) {
    return NextResponse.json({ error: "يجب الموافقة صراحةً على مشاركة تفاصيل الطلب الأساسية مع الجهات المطابقة." }, { status: 422 });
  }

  const parsedIntent = parseTravelerIntent(body.intent);
  if (!parsedIntent.ok) {
    return NextResponse.json({ error: parsedIntent.error }, { status: 422 });
  }
  const intent = parsedIntent.value;
  const count = travelerCount(intent);
  if (count < 1 || count > 80) {
    return NextResponse.json({ error: "عدد المسافرين غير صحيح." }, { status: 422 });
  }

  const savedIntentId = body.savedIntentId == null || body.savedIntentId === ""
    ? null
    : positiveId(body.savedIntentId);
  if (body.savedIntentId != null && body.savedIntentId !== "" && !savedIntentId) {
    return NextResponse.json({ error: "نية السفر المحفوظة غير صحيحة." }, { status: 422 });
  }
  if (savedIntentId && process.env.TRAVELER_WORKSPACE_ENABLED !== "true") {
    return NextResponse.json({ error: "ربط نية السفر غير متاح في هذه البيئة." }, { status: 404 });
  }

  const category = body.category;
  const candidates = await db
    .select({
      agent: agents,
      workspaceId: agencyWorkspaces.id,
      workspaceName: agencyWorkspaces.name,
      ownerAccountId: agencyMemberships.accountId,
    })
    .from(agencyWorkspaces)
    .innerJoin(agents, eq(agencyWorkspaces.agentId, agents.id))
    .innerJoin(agencyMemberships, and(
      eq(agencyMemberships.workspaceId, agencyWorkspaces.id),
      eq(agencyMemberships.role, "owner"),
      eq(agencyMemberships.status, "active"),
    ))
    .where(and(
      eq(agencyWorkspaces.status, "active"),
      eq(agents.verificationStatus, "verified"),
    ))
    .orderBy(desc(agents.responseRate), asc(agents.avgResponseHours), desc(agents.totalTrips), asc(agents.id));

  const categoryCandidates = candidates.filter((candidate) =>
    providerMatchesMarketplaceCategory(candidate.agent.specialtyTags, category)
  );
  if (categoryCandidates.length === 0) {
    return NextResponse.json(
      { error: "لا توجد حاليًا جهة مؤهلة بتخصص معلن ومطابق لهذا النوع من الخدمات. لم يتم إنشاء الطلب أو إرساله." },
      { status: 422 },
    );
  }

  const observedAt = new Date();
  const evidence = await loadPublicAgentEvidence(categoryCandidates.map((candidate) => candidate.agent.id));
  const trusted = categoryCandidates.filter((candidate) =>
    evaluatePublicAgentTrust(candidate.agent, evidence.get(candidate.agent.id) ?? [], observedAt).eligible
  );
  const ranked = rankMarketplaceRecipients(trusted.map((candidate) => ({
    ...candidate,
    agentId: candidate.agent.id,
    responseRate: candidate.agent.responseRate,
    avgResponseHours: candidate.agent.avgResponseHours,
    totalTrips: candidate.agent.totalTrips,
  }))).slice(0, MARKETPLACE_REQUEST_RECIPIENT_LIMIT);

  if (ranked.length === 0) {
    return NextResponse.json(
      { error: "لم نجد جهة تستوفي متطلبات الثقة الحالية لهذا التخصص. لم يتم إنشاء الطلب أو إرساله." },
      { status: 422 },
    );
  }

  const snapshot = {
    version: 1,
    category,
    categoryLabel: MARKETPLACE_REQUEST_CATEGORY_LABELS[category],
    intent,
    matchingPolicy: "verified-active-explicit-specialty-v1",
    matchedAt: observedAt.toISOString(),
    sharedFields: ["category", "originCity", "destinations", "dates", "travelers", "budget", "priorities", "constraints", "notes"],
  };
  const travelerName = account.displayName.trim().slice(0, 120) || "مسافر صلة";
  const travelerEmail = account.email.trim().toLowerCase();
  const travelDates = intent.departureDate
    ? intent.returnDate ? `${intent.departureDate} → ${intent.returnDate}` : intent.departureDate
    : null;
  const message = typeof intent.notes === "string" && intent.notes.trim()
    ? intent.notes.trim().slice(0, 2000)
    : `طلب جديد لخدمة: ${MARKETPLACE_REQUEST_CATEGORY_LABELS[category]}.`;

  const client = await pool.connect();
  let requestId: number | null = null;
  try {
    await client.query("BEGIN");

    if (savedIntentId) {
      const owned = await client.query(
        `SELECT id FROM traveler_saved_intents
          WHERE id = $1 AND account_id = $2 AND status = 'active'
          LIMIT 1 FOR SHARE`,
        [savedIntentId, account.id],
      );
      if (!owned.rows[0]) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "نية السفر غير موجودة أو لا تخص هذا الحساب." }, { status: 404 });
      }
    }

    const inserted = await client.query<{ id: number }>(
      `INSERT INTO contact_requests
        (offer_id, agent_id, request_kind, request_snapshot, share_consent_at,
         traveler_account_id, traveler_name, traveler_email, message, traveler_count,
         travel_dates, status)
       VALUES (NULL, NULL, 'open_request', $1::jsonb, NOW(),
               $2,$3,$4,$5,$6,$7,'new')
       RETURNING id`,
      [JSON.stringify(snapshot), account.id, travelerName, travelerEmail, message, count, travelDates],
    );
    requestId = inserted.rows[0]!.id;

    if (savedIntentId) {
      await client.query(
        `INSERT INTO traveler_intent_inquiries (saved_intent_id, contact_request_id)
         VALUES ($1,$2)`,
        [savedIntentId, requestId],
      );
    }

    for (const recipient of ranked) {
      await client.query(
        `INSERT INTO marketplace_request_recipients
          (contact_request_id, workspace_id, agent_id, status, matching_reason)
         VALUES ($1,$2,$3,'sent',$4)`,
        [requestId, recipient.workspaceId, recipient.agentId, `specialty:${category}:explicit_tag`],
      );
      await client.query(
        `INSERT INTO agency_domain_events
          (workspace_id, actor_account_id, event_type, payload, reference_type, reference_id, correlation_id)
         VALUES ($1,$2,'marketplace.request_received',$3::jsonb,'contact_request',$4,$5)`,
        [
          recipient.workspaceId,
          account.id,
          JSON.stringify({ category, recipientCount: ranked.length, requestKind: "open_request" }),
          requestId,
          randomUUID(),
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* transaction already closed */ }
    const code = (error as { code?: string }).code;
    if (code === "23514" || code === "23505") {
      return NextResponse.json({ error: "تعذر توجيه الطلب بسبب تعارض في بيانات التوزيع. لم نؤكد الإرسال." }, { status: 409 });
    }
    console.error("Marketplace open request creation failed", code ?? "unknown");
    return NextResponse.json({ error: "تعذر إنشاء طلب السوق بأمان." }, { status: 500 });
  } finally {
    client.release();
  }

  await Promise.all(ranked.map((recipient) => notify({
    accountId: recipient.ownerAccountId,
    type: "marketplace_request_received",
    title: "طلب مسافر جديد يناسب تخصص وكالتك",
    body: `طلب TRQ-${String(requestId).padStart(5, "0")} في تخصص ${MARKETPLACE_REQUEST_CATEGORY_LABELS[category]} أصبح متاحًا في صندوق طلبات الوكالة.`,
    link: "/account/agency",
    targetId: requestId,
    dedupeScope: `marketplace-request:${requestId}:workspace:${recipient.workspaceId}`,
  })));

  return NextResponse.json({
    request: {
      id: requestId,
      reference: `TRQ-${String(requestId).padStart(5, "0")}`,
      category,
      categoryLabel: MARKETPLACE_REQUEST_CATEGORY_LABELS[category],
      status: "sent",
      providerCount: ranked.length,
      providers: ranked.map((recipient) => ({
        name: recipient.agent.displayName,
        city: recipient.agent.city,
        country: recipient.agent.country,
      })),
      recipientLimit: MARKETPLACE_REQUEST_RECIPIENT_LIMIT,
    },
  }, { status: 201, headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  if (process.env.MULTI_PROVIDER_REQUESTS_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const account = await accountFromRequest(request);
  if (!account || account.role !== "traveler") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await pool.query(
    `SELECT cr.id, cr.status, cr.request_snapshot, cr.created_at AS "createdAt",
            rr.status AS "recipientStatus", rr.sent_at AS "sentAt", rr.responded_at AS "respondedAt",
            w.name AS "providerName", w.id AS "workspaceId",
            ao.id AS "opportunityId",
            (SELECT COUNT(*)::int FROM marketplace_request_recipients allr WHERE allr.contact_request_id = cr.id) AS "providerCount",
            (SELECT COUNT(*)::int FROM agency_quote_deliveries qd
              WHERE qd.opportunity_id = ao.id AND qd.status IN ('active','responded')
                AND qd.expires_at > NOW()) AS "availableQuotes"
       FROM contact_requests cr
       LEFT JOIN marketplace_request_recipients rr ON rr.contact_request_id = cr.id
       LEFT JOIN agency_workspaces w ON w.id = rr.workspace_id
       LEFT JOIN agency_opportunities ao
         ON ao.id = rr.opportunity_id
        AND ao.workspace_id = rr.workspace_id
        AND ao.source_contact_request_id = cr.id
      WHERE cr.request_kind = 'open_request'
        AND cr.traveler_account_id = $1
      ORDER BY cr.created_at DESC, rr.sent_at ASC`,
    [account.id],
  );
  const grouped = new Map<number, Record<string, unknown>>();
  for (const row of result.rows as Array<Record<string, unknown>>) {
    const id = Number(row.id);
    let item = grouped.get(id);
    if (!item) {
      const snapshot = row.request_snapshot && typeof row.request_snapshot === "object" && !Array.isArray(row.request_snapshot)
        ? row.request_snapshot as Record<string, unknown>
        : {};
      item = {
        id,
        reference: `TRQ-${String(id).padStart(5, "0")}`,
        status: row.status,
        category: snapshot.category ?? null,
        categoryLabel: snapshot.categoryLabel ?? null,
        intent: snapshot.intent ?? null,
        createdAt: row.createdAt,
        providerCount: Number(row.providerCount) || 0,
        providers: [],
      };
      grouped.set(id, item);
    }
    if (row.workspaceId != null) {
      (item.providers as Array<Record<string, unknown>>).push({
        workspaceId: Number(row.workspaceId),
        name: row.providerName,
        status: row.recipientStatus,
        opportunityId: row.opportunityId == null ? null : Number(row.opportunityId),
        availableQuotes: Number(row.availableQuotes) || 0,
      });
    }
  }
  return NextResponse.json({ requests: [...grouped.values()] }, { headers: { "cache-control": "no-store" } });
}

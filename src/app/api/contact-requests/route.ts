import { NextResponse } from "next/server";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { agents, contactRequests, offers } from "@/db/schema";
import { getRecentContactRequests } from "@/lib/data";
import { accountFromRequest } from "@/lib/identity";
import { accountIdForAgent, notify } from "@/lib/notify";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOUR_MS = 3_600_000;

class DuplicateContactError extends Error {}
class ContactVolumeError extends Error {}
class OfferUnavailableError extends Error {}

function publicOfferPredicate(offerId: number, now: Date) {
  return and(
    eq(offers.id, offerId),
    eq(offers.status, "published"),
    eq(agents.verificationStatus, "verified"),
    or(isNull(offers.expiresAt), gt(offers.expiresAt, now)),
  );
}

function pgCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 6; depth += 1) {
    if (typeof current !== "object" || current === null) return null;
    if ("code" in current) {
      const code = String((current as { code?: unknown }).code ?? "");
      if (code) return code;
    }
    if (!("cause" in current)) return null;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

/**
 * Authenticated request feed with fail-closed ownership:
 * - admin: recent operational feed
 * - agent: only requests owned by that agent profile
 * - traveler: only requests explicitly bound to that account id
 */
export async function GET(request: Request) {
  const account = await accountFromRequest(request);
  if (!account) {
    return NextResponse.json({ error: "Unauthorized — سجّل الدخول أولاً." }, { status: 401 });
  }

  if (account.role === "admin") {
    const rows = await getRecentContactRequests(50);
    return NextResponse.json({ count: rows.length, contactRequests: rows });
  }

  if (account.role === "agent") {
    if (!account.agentId) {
      return NextResponse.json({ count: 0, contactRequests: [] });
    }
    const rows = await db
      .select()
      .from(contactRequests)
      .where(eq(contactRequests.agentId, account.agentId))
      .orderBy(desc(contactRequests.createdAt))
      .limit(50);
    return NextResponse.json({ count: rows.length, contactRequests: rows });
  }

  if (account.role === "traveler") {
    const rows = await db
      .select()
      .from(contactRequests)
      .where(eq(contactRequests.travelerAccountId, account.id))
      .orderBy(desc(contactRequests.createdAt))
      .limit(50);
    return NextResponse.json({ count: rows.length, contactRequests: rows });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const ipLimit = rateLimiter.checkRateLimit(
    `contact:create:ip:${clientIpFromRequest(request)}`,
    10,
    600,
  );
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "طلبات كثيرة في وقت قصير — حاول مرة أخرى لاحقًا." },
      { status: 429, headers: { "Retry-After": String(ipLimit.resetSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    offerId, travelerName, travelerEmail, travelerCount, travelDates, message,
    utmSource, utmMedium, utmCampaign,
  } = (body ?? {}) as Record<string, unknown>;
  const utm = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : null;

  const parsedOfferId = Number(offerId);
  if (!Number.isInteger(parsedOfferId) || parsedOfferId <= 0) {
    return NextResponse.json({ error: "عرض غير معروف." }, { status: 422 });
  }

  const account = await accountFromRequest(request);
  const travelerAccount = account?.role === "traveler" ? account : null;

  if (
    typeof travelerName !== "string" ||
    travelerName.trim().length < 2 ||
    travelerName.trim().length > 120
  ) {
    return NextResponse.json({ error: "اكتب اسمًا صحيحًا بحد أقصى ١٢٠ حرفًا." }, { status: 422 });
  }

  let normalizedEmail: string;
  if (travelerAccount) {
    normalizedEmail = travelerAccount.email.trim().toLowerCase();
  } else {
    if (
      typeof travelerEmail !== "string" ||
      travelerEmail.trim().length > 200 ||
      !EMAIL_RE.test(travelerEmail.trim())
    ) {
      return NextResponse.json({ error: "صيغة البريد الإلكتروني غير صحيحة." }, { status: 422 });
    }
    normalizedEmail = travelerEmail.trim().toLowerCase();
  }

  if (
    typeof message !== "string" ||
    message.trim().length < 10 ||
    message.trim().length > 2000
  ) {
    return NextResponse.json({ error: "اكتب رسالة بين ١٠ و٢٠٠٠ حرف." }, { status: 422 });
  }
  if (typeof travelDates === "string" && travelDates.trim().length > 200) {
    return NextResponse.json({ error: "تفاصيل التواريخ طويلة جدًا." }, { status: 422 });
  }

  const now = new Date();
  const initialRows = await db
    .select({ offer: offers })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(publicOfferPredicate(parsedOfferId, now))
    .limit(1);
  const initialOffer = initialRows[0]?.offer;
  if (!initialOffer) {
    return NextResponse.json({ error: "هذا العرض لم يعد متاحاً." }, { status: 404 });
  }

  const count = Number(travelerCount ?? 2);
  if (
    !Number.isInteger(count) ||
    count < initialOffer.minTravelers ||
    count > initialOffer.maxTravelers
  ) {
    return NextResponse.json(
      { error: `عدد المسافرين لهذا العرض بين ${initialOffer.minTravelers} و ${initialOffer.maxTravelers}.` },
      { status: 422 },
    );
  }

  let created: { id: number; createdAt: Date };
  let offer = initialOffer;
  try {
    const result = await db.transaction(async (tx) => {
      const duplicateKey = `contact:${parsedOfferId}:${normalizedEmail}`;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${duplicateKey}))`);

      const currentRows = await tx
        .select({ offer: offers })
        .from(offers)
        .innerJoin(agents, eq(offers.agentId, agents.id))
        .where(publicOfferPredicate(parsedOfferId, new Date()))
        .limit(1);
      const currentOffer = currentRows[0]?.offer;
      if (!currentOffer) throw new OfferUnavailableError();

      const sinceDay = new Date(Date.now() - 86_400_000);
      const dupes = await tx
        .select({ id: contactRequests.id })
        .from(contactRequests)
        .where(
          and(
            eq(contactRequests.offerId, currentOffer.id),
            eq(contactRequests.travelerEmail, normalizedEmail),
            gt(contactRequests.createdAt, sinceDay),
          ),
        )
        .limit(1);
      if (dupes[0]) throw new DuplicateContactError();

      // Distributed abuse bound across serverless instances without a new table:
      // one email may contact at most 10 distinct offers in a rolling hour.
      const recentByEmail = await tx
        .select({ id: contactRequests.id })
        .from(contactRequests)
        .where(
          and(
            eq(contactRequests.travelerEmail, normalizedEmail),
            gt(contactRequests.createdAt, new Date(Date.now() - HOUR_MS)),
          ),
        )
        .limit(10);
      if (recentByEmail.length >= 10) throw new ContactVolumeError();

      const offerSnapshot = JSON.stringify({
        offerId: currentOffer.id,
        title: currentOffer.title,
        priceAmount: currentOffer.priceAmount,
        currency: currentOffer.currency,
        priceType: currentOffer.priceType,
        route: `${currentOffer.originCity} ← ${currentOffer.destinationCity}`,
        departureDate: currentOffer.departureDate,
        expiresAt: currentOffer.expiresAt,
        capturedAt: new Date().toISOString(),
      });

      const [inserted] = await tx
        .insert(contactRequests)
        .values({
          offerId: currentOffer.id,
          agentId: currentOffer.agentId,
          travelerAccountId: travelerAccount?.id ?? null,
          travelerName: travelerName.trim(),
          travelerEmail: normalizedEmail,
          message: message.trim(),
          offerSnapshot,
          travelerCount: count,
          travelDates:
            typeof travelDates === "string" && travelDates.trim()
              ? travelDates.trim()
              : null,
          utmSource: utm(utmSource),
          utmMedium: utm(utmMedium),
          utmCampaign: utm(utmCampaign),
        })
        .returning({ id: contactRequests.id, createdAt: contactRequests.createdAt });

      await tx
        .update(offers)
        .set({ contactCount: sql`${offers.contactCount} + 1` })
        .where(eq(offers.id, currentOffer.id));

      return { created: inserted, offer: currentOffer };
    });
    created = result.created;
    offer = result.offer;
  } catch (error) {
    if (error instanceof DuplicateContactError) {
      return NextResponse.json(
        { error: "أرسلت طلباً لهذا العرض خلال ٢٤ ساعة — راجع طلبك الحالي بدل إرسال نسخة جديدة." },
        { status: 429 },
      );
    }
    if (error instanceof ContactVolumeError) {
      return NextResponse.json(
        { error: "وصلت للحد المؤقت لطلبات التواصل. راجع طلباتك الحالية ثم حاول لاحقًا." },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }
    if (error instanceof OfferUnavailableError) {
      return NextResponse.json({ error: "هذا العرض لم يعد متاحاً." }, { status: 404 });
    }
    console.error("contact.create.failed", { code: pgCode(error) ?? "unknown" });
    return NextResponse.json(
      { error: "تعذر إرسال الطلب الآن. حاول مرة أخرى." },
      { status: 500 },
    );
  }

  const ownerId = await accountIdForAgent(offer.agentId);
  if (ownerId) {
    void notify({
      accountId: ownerId,
      type: "lead_new",
      title: "طلب تواصل جديد",
      body: `${travelerName.trim()} (${count} ${count === 1 ? "مسافر" : "مسافرين"}) سأل عن «${offer.title}». الرد السريع يحسن تجربة المسافر ومعدل استجابتك.`,
      link: "/account",
      targetId: created.id,
    });
  }

  return NextResponse.json(
    {
      id: created.id,
      createdAt: created.createdAt,
      status: "new",
      message: "وصل طلبك للوكيل. يمكنك متابعة حالته من حسابك إذا كنت مسجّل الدخول.",
    },
    { status: 201 },
  );
}

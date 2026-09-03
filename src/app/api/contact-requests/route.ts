import { NextResponse } from "next/server";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { contactRequests, offers } from "@/db/schema";
import { getRecentContactRequests } from "@/lib/data";
import { requireAdmin } from "@/lib/auth";
import { accountIdForAgent, notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Traveler PII — privileged feed only (P0 privacy boundary)
export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const rows = await getRecentContactRequests(25);
  return NextResponse.json({ count: rows.length, contactRequests: rows });
}

export async function POST(request: Request) {
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
  if (!Number.isInteger(parsedOfferId)) {
    return NextResponse.json({ error: "عرض غير معروف." }, { status: 422 });
  }

  const offerRows = await db
    .select()
    .from(offers)
    .where(eq(offers.id, parsedOfferId))
    .limit(1);
  const offer = offerRows[0];
  if (!offer || offer.status !== "published") {
    return NextResponse.json({ error: "هذا العرض لم يعد متاحاً." }, { status: 404 });
  }

  if (typeof travelerName !== "string" || travelerName.trim().length < 2) {
    return NextResponse.json({ error: "نحتاج اسمك الكريم ليعرف الوكيل مع من يتحدث." }, { status: 422 });
  }
  if (typeof travelerEmail !== "string" || !EMAIL_RE.test(travelerEmail.trim())) {
    return NextResponse.json({ error: "صيغة البريد الإلكتروني غير صحيحة." }, { status: 422 });
  }
  if (typeof message !== "string" || message.trim().length < 10) {
    return NextResponse.json({ error: "اكتب رسالة من عشرة أحرف على الأقل — سؤال حقيقي يستحق رداً حقيقياً." }, { status: 422 });
  }

  const count = Number(travelerCount ?? 2);
  if (!Number.isInteger(count) || count < 1 || count > offer.maxTravelers) {
    return NextResponse.json(
      { error: `عدد المسافرين لهذا العرض بين ${offer.minTravelers} و ${offer.maxTravelers}.` },
      { status: 422 },
    );
  }

  // Abuse prevention: one request per traveler per offer per 24h
  const since = new Date(Date.now() - 86_400_000);
  const dupes = await db
    .select({ id: contactRequests.id })
    .from(contactRequests)
    .where(
      and(
        eq(contactRequests.offerId, offer.id),
        eq(contactRequests.travelerEmail, travelerEmail.trim().toLowerCase()),
        gt(contactRequests.createdAt, since),
      ),
    )
    .limit(1);
  if (dupes[0]) {
    return NextResponse.json(
      { error: "أرسلت طلباً لهذا العرض خلال ٢٤ ساعة — الوكيل على الأرجح يراجع طلبك الأول الآن." },
      { status: 429 },
    );
  }

  // Offer snapshot — disputes must not depend on mutable current state (§20)
  const offerSnapshot = JSON.stringify({
    offerId: offer.id,
    title: offer.title,
    priceAmount: offer.priceAmount,
    currency: offer.currency,
    priceType: offer.priceType,
    route: `${offer.originCity} ← ${offer.destinationCity}`,
    departureDate: offer.departureDate,
    expiresAt: offer.expiresAt,
    capturedAt: new Date().toISOString(),
  });

  const [created] = await db
    .insert(contactRequests)
    .values({
      offerId: offer.id,
      agentId: offer.agentId,
      travelerName: travelerName.trim(),
      travelerEmail: travelerEmail.trim().toLowerCase(),
      message: message.trim(),
      offerSnapshot,
      travelerCount: count,
      travelDates:
        typeof travelDates === "string" && travelDates.trim() ? travelDates.trim() : null,
      utmSource: utm(utmSource),
      utmMedium: utm(utmMedium),
      utmCampaign: utm(utmCampaign),
    })
    .returning({ id: contactRequests.id, createdAt: contactRequests.createdAt });

  // V1 agent analytics: contact count per offer (spec §4.7)
  await db
    .update(offers)
    .set({ contactCount: sql`${offers.contactCount} + 1` })
    .where(eq(offers.id, offer.id));

  const ownerId = await accountIdForAgent(offer.agentId);
  if (ownerId) {
    void notify({
      accountId: ownerId,
      type: "lead_new",
      title: "طلب تواصل جديد",
      body: `${travelerName.trim()} (${count} ${count === 1 ? "مسافر" : "مسافرين"}) سأل عن «${offer.title}». الرد خلال ٤٨ ساعة يحافظ على معدل استجابتك.`,
      link: "/account",
      targetId: offer.id,
    });
  }

  return NextResponse.json(
    {
      id: created.id,
      createdAt: created.createdAt,
      status: "new",
      message: "وصل طلبك للوكيل — يرد خلال ٤٨ ساعة كحد أقصى.",
    },
    { status: 201 },
  );
}

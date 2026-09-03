import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, auditLog, offers } from "@/db/schema";
import { accountFromRequest } from "@/lib/identity";
import { TRIP_TYPES } from "@/lib/format";

export const dynamic = "force-dynamic";

const CURRENCIES = new Set(["SAR", "AED", "USD", "EGP", "EUR"]);
const PRICE_TYPES = new Set(["per_person", "per_group", "starting_from"]);
const DEFAULT_HERO: Record<string, string> = {
  umrah: "https://images.pexels.com/photos/38546883/pexels-photo-38546883.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  package: "https://images.pexels.com/photos/38723717/pexels-photo-38723717.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  visa: "https://images.pexels.com/photos/32447869/pexels-photo-32447869.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  flight: "https://images.pexels.com/photos/31256089/pexels-photo-31256089.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  hotel: "https://images.pexels.com/photos/27099922/pexels-photo-27099922.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  cruise: "https://images.pexels.com/photos/37559111/pexels-photo-37559111.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
};

function cleanStrings(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((x) => x.slice(0, 90));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "published";
  const type = searchParams.get("type");

  const rows = await db
    .select({ offer: offers, agent: agents })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(eq(offers.status, status))
    .orderBy(desc(offers.isFeatured), desc(offers.publishedAt));

  const filtered = type
    ? rows.filter((r) => r.offer.tripType === type)
    : rows;

  return NextResponse.json({
    count: filtered.length,
    offers: filtered.map((r) => ({ ...r.offer, agent: r.agent })),
  });
}

// Agent self-service: verified agents draft offers straight into pending_review.
export async function POST(request: Request) {
  const account = await accountFromRequest(request);
  if (!account || account.role !== "agent" || !account.agentId) {
    return NextResponse.json(
      { error: "إنشاء العروض لحسابات الوكلاء فقط." },
      { status: 401 },
    );
  }

  const agentRows = await db.select().from(agents).where(eq(agents.id, account.agentId)).limit(1);
  const agent = agentRows[0];
  if (!agent || agent.verificationStatus !== "verified") {
    return NextResponse.json(
      { error: "نشر العروض يتاح بعد اعتماد التوثيق — القاعدة تحمي المسافر قبل الوكيل." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const err = (m: string) => NextResponse.json({ error: m }, { status: 422 });

  if (str(b.title).length < 10) return err("العنوان ١٠ أحرف على الأقل — كن وصفيًا وصادقًا.");
  if (str(b.description).length < 60) return err("الوصف ٦٠ حرفًا على الأقل — التفاصيل تصنع الثقة.");
  const tripType = str(b.tripType);
  if (!TRIP_TYPES.some((t) => t.key === tripType)) return err("نوع الرحلة غير معروف.");
  const price = Number(b.priceAmount);
  if (!Number.isInteger(price) || price < 100 || price > 1_000_000) return err("السعر يجب أن يكون قيمة صحيحة واقعية.");
  const currency = str(b.currency) || "SAR";
  if (!CURRENCIES.has(currency)) return err("العملة يجب أن تكون SAR أو AED أو USD أو EGP أو EUR.");
  const priceType = str(b.priceType) || "per_person";
  if (!PRICE_TYPES.has(priceType)) return err("أساس التسعير غير معروف.");
  const includes = cleanStrings(b.includes, 12);
  if (includes.length === 0) return err("اذكر مشمولًا واحدًا على الأقل — سياسة «لا عرض بلا تفصيل».");
  const excludes = cleanStrings(b.excludes, 12);
  if (!str(b.originCity) || !str(b.destinationCity) || !str(b.destinationCountry) || !str(b.destinationCountryEn)) {
    return err("مدينة الانطلاق والوجهة (بالعربية والإنجليزية) حقول إلزامية.");
  }
  const duration = b.durationDays === undefined || b.durationDays === null || b.durationDays === "" ? null : Number(b.durationDays);
  if (duration !== null && (!Number.isInteger(duration) || duration < 1 || duration > 45)) return err("المدة بين يوم و٤٥ يومًا.");
  const maxT = Number(b.maxTravelers ?? 8);
  if (!Number.isInteger(maxT) || maxT < 1 || maxT > 50) return err("الحد الأقصى للمسافرين بين ١ و ٥٠.");

  const [created] = await db
    .insert(offers)
    .values({
      agentId: agent.id,
      title: str(b.title).slice(0, 160),
      titleEn: str(b.titleEn) || null,
      description: str(b.description).slice(0, 4000),
      tripType,
      originCity: str(b.originCity).slice(0, 60),
      destinationCity: str(b.destinationCity).slice(0, 60),
      destinationCountry: str(b.destinationCountry).slice(0, 60),
      destinationCountryEn: str(b.destinationCountryEn).slice(0, 60),
      departureDate: null,
      durationDays: duration,
      priceAmount: price,
      currency,
      priceType,
      includes,
      excludes,
      minTravelers: 1,
      maxTravelers: maxT,
      status: "pending_review",
      heroImage: DEFAULT_HERO[tripType],
      isFeatured: false,
    })
    .returning({ id: offers.id });

  await db.insert(auditLog).values({
    actor: `agent:${agent.id}`,
    action: "offer_submitted",
    targetType: "offer",
    targetId: created.id,
    reason: null,
    prevState: null,
    newState: "pending_review",
    meta: `${str(b.title).slice(0, 80)} · ${price} ${currency}`,
  });

  return NextResponse.json(
    {
      id: created.id,
      status: "pending_review",
      message: "دخل عرضك طابور المراجعة — بعد اعتماده يُنشر لمدة ٩٠ يومًا.",
    },
    { status: 201 },
  );
}

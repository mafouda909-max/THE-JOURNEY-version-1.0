import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, auditLog, offers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { accountFromRequest } from "@/lib/identity";
import { TRIP_TYPES } from "@/lib/format";
import { accountIdForAgent, notify } from "@/lib/notify";
import { toPublicAgent } from "@/lib/public-agent";

export const dynamic = "force-dynamic";

const NINETY_DAYS = 90 * 86_400_000;
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

function cleanStrings(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((item) => item.slice(0, 90));
}

function parseOfferUpdate(body: unknown):
  | { ok: true; value: {
      title: string;
      titleEn: string | null;
      description: string;
      tripType: string;
      originCity: string;
      destinationCity: string;
      destinationCountry: string;
      destinationCountryEn: string;
      priceAmount: number;
      currency: string;
      priceType: string;
      durationDays: number | null;
      maxTravelers: number;
      includes: string[];
      excludes: string[];
    } }
  | { ok: false; error: string } {
  const payload = (body ?? {}) as Record<string, unknown>;
  const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const title = str(payload.title);
  const description = str(payload.description);
  if (title.length < 10) return { ok: false, error: "العنوان ١٠ أحرف على الأقل — كن وصفيًا وصادقًا." };
  if (description.length < 60) return { ok: false, error: "الوصف ٦٠ حرفًا على الأقل — التفاصيل تصنع الثقة." };

  const tripType = str(payload.tripType);
  if (!TRIP_TYPES.some((type) => type.key === tripType)) return { ok: false, error: "نوع الرحلة غير معروف." };

  const priceAmount = Number(payload.priceAmount);
  if (!Number.isInteger(priceAmount) || priceAmount < 100 || priceAmount > 1_000_000) {
    return { ok: false, error: "السعر يجب أن يكون قيمة صحيحة واقعية." };
  }
  const currency = str(payload.currency) || "SAR";
  if (!CURRENCIES.has(currency)) return { ok: false, error: "العملة يجب أن تكون SAR أو AED أو USD أو EGP أو EUR." };
  const priceType = str(payload.priceType) || "per_person";
  if (!PRICE_TYPES.has(priceType)) return { ok: false, error: "أساس التسعير غير معروف." };

  const includes = cleanStrings(payload.includes, 12);
  if (includes.length === 0) return { ok: false, error: "اذكر مشمولًا واحدًا على الأقل — سياسة «لا عرض بلا تفصيل»." };
  const excludes = cleanStrings(payload.excludes, 12);

  const originCity = str(payload.originCity);
  const destinationCity = str(payload.destinationCity);
  const destinationCountry = str(payload.destinationCountry);
  const destinationCountryEn = str(payload.destinationCountryEn);
  if (!originCity || !destinationCity || !destinationCountry || !destinationCountryEn) {
    return { ok: false, error: "مدينة الانطلاق والوجهة (بالعربية والإنجليزية) حقول إلزامية." };
  }

  const durationDays = payload.durationDays === undefined || payload.durationDays === null || payload.durationDays === ""
    ? null
    : Number(payload.durationDays);
  if (durationDays !== null && (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 45)) {
    return { ok: false, error: "المدة بين يوم و٤٥ يومًا." };
  }
  const maxTravelers = Number(payload.maxTravelers ?? 8);
  if (!Number.isInteger(maxTravelers) || maxTravelers < 1 || maxTravelers > 50) {
    return { ok: false, error: "الحد الأقصى للمسافرين بين ١ و٥٠." };
  }

  return {
    ok: true,
    value: {
      title: title.slice(0, 160),
      titleEn: str(payload.titleEn).slice(0, 160) || null,
      description: description.slice(0, 4000),
      tripType,
      originCity: originCity.slice(0, 60),
      destinationCity: destinationCity.slice(0, 60),
      destinationCountry: destinationCountry.slice(0, 60),
      destinationCountryEn: destinationCountryEn.slice(0, 60),
      priceAmount,
      currency,
      priceType,
      durationDays,
      maxTravelers,
      includes,
      excludes,
    },
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return NextResponse.json({ error: "Invalid offer id" }, { status: 400 });
  }

  const rows = await db
    .select({ offer: offers, agent: agents })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(eq(offers.id, parsed))
    .limit(1);

  if (!rows[0]) {
    return NextResponse.json({ error: "العرض غير موجود" }, { status: 404 });
  }
  const { offer, agent } = rows[0];
  const expired = offer.expiresAt !== null && offer.expiresAt.getTime() <= Date.now();
  if (offer.status !== "published" || agent.verificationStatus !== "verified" || expired) {
    return NextResponse.json({ error: "العرض غير متاح" }, { status: 404 });
  }
  return NextResponse.json({ offer: { ...offer, agent: toPublicAgent(agent) } });
}

/**
 * Agent correction path. A rejected offer may be edited by its owning,
 * currently verified agent and is atomically returned to pending review.
 * Published/pending offers stay immutable here so moderation cannot be bypassed.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const account = await accountFromRequest(request);
  if (!account || account.role !== "agent" || !account.agentId) {
    return NextResponse.json({ error: "تعديل العروض لحسابات الوكلاء فقط." }, { status: 401 });
  }

  const { id } = await params;
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return NextResponse.json({ error: "Invalid offer id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsedBody = parseOfferUpdate(body);
  if (!parsedBody.ok) return NextResponse.json({ error: parsedBody.error }, { status: 422 });

  const currentRows = await db
    .select({ offer: offers, agentStatus: agents.verificationStatus })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(and(eq(offers.id, parsed), eq(offers.agentId, account.agentId)))
    .limit(1);
  const current = currentRows[0];
  if (!current) {
    // Deliberately do not distinguish a foreign offer from a missing one.
    return NextResponse.json({ error: "العرض غير موجود في حسابك." }, { status: 404 });
  }
  if (current.agentStatus !== "verified") {
    return NextResponse.json({ error: "يجب أن يكون توثيق الوكيل معتمدًا قبل إعادة إرسال العرض." }, { status: 403 });
  }
  if (current.offer.status !== "rejected") {
    return NextResponse.json(
      { error: `يمكن تعديل وإعادة إرسال العرض بعد الرفض فقط؛ حالته الحالية «${current.offer.status}».` },
      { status: 409 },
    );
  }

  const value = parsedBody.value;
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(offers)
      .set({
        title: value.title,
        titleEn: value.titleEn,
        description: value.description,
        tripType: value.tripType,
        originCity: value.originCity,
        destinationCity: value.destinationCity,
        destinationCountry: value.destinationCountry,
        destinationCountryEn: value.destinationCountryEn,
        priceAmount: value.priceAmount,
        currency: value.currency,
        priceType: value.priceType,
        durationDays: value.durationDays,
        maxTravelers: value.maxTravelers,
        includes: value.includes,
        excludes: value.excludes,
        heroImage: DEFAULT_HERO[value.tripType],
        status: "pending_review",
        rejectionReason: null,
        publishedAt: null,
        expiresAt: null,
        isFeatured: false,
      })
      .where(and(
        eq(offers.id, parsed),
        eq(offers.agentId, account.agentId!),
        eq(offers.status, "rejected"),
      ))
      .returning();
    if (!row) return null;

    await tx.insert(auditLog).values({
      actor: `agent:${account.agentId}`,
      action: "offer_resubmitted",
      targetType: "offer",
      targetId: row.id,
      reason: "عدّل الوكيل العرض بعد الرفض وأعاده للمراجعة.",
      prevState: "rejected",
      newState: "pending_review",
      meta: `price=${row.priceAmount}${row.currency}`,
    });
    return row;
  });

  if (!updated) {
    return NextResponse.json(
      { error: "تغيّرت حالة العرض أثناء التعديل. حدّث الصفحة وحاول مرة أخرى." },
      { status: 409 },
    );
  }

  return NextResponse.json({
    offer: updated,
    message: "تم حفظ التعديلات وإعادة العرض إلى طابور المراجعة.",
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return NextResponse.json({ error: "Invalid offer id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, reason } = (body ?? {}) as Record<string, unknown>;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "Action must be 'approve' or 'reject'" },
      { status: 422 },
    );
  }

  if (action === "reject") {
    if (typeof reason !== "string" || reason.trim().length < 10 || reason.trim().length > 1000) {
      return NextResponse.json(
        { error: "سبب الرفض مطلوب بين ١٠ و١٠٠٠ حرف، ويُرسل للوكيل." },
        { status: 422 },
      );
    }
  }

  const currentRows = await db
    .select({ offer: offers, agentStatus: agents.verificationStatus })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(eq(offers.id, parsed))
    .limit(1);
  const current = currentRows[0];
  if (!current) {
    return NextResponse.json({ error: "العرض غير موجود" }, { status: 404 });
  }
  if (current.offer.status !== "pending_review") {
    return NextResponse.json(
      { error: `العرض لم يعد بانتظار المراجعة؛ حالته الحالية «${current.offer.status}». حدّث الطابور قبل اتخاذ قرار جديد.` },
      { status: 409 },
    );
  }
  if (action === "approve" && current.agentStatus !== "verified") {
    return NextResponse.json(
      { error: "لا يمكن نشر عرض لوكيل غير موثّق حاليًا." },
      { status: 422 },
    );
  }

  const now = new Date();
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(offers)
      .set(
        action === "approve"
          ? {
              status: "published",
              rejectionReason: null,
              publishedAt: now,
              expiresAt: new Date(now.getTime() + NINETY_DAYS),
            }
          : {
              status: "rejected",
              rejectionReason: (reason as string).trim(),
              publishedAt: null,
              expiresAt: null,
            },
      )
      .where(and(eq(offers.id, parsed), eq(offers.status, "pending_review")))
      .returning();

    if (!row) return null;

    await tx.insert(auditLog).values({
      actor: "admin",
      action: action === "approve" ? "offer_approved" : "offer_rejected",
      targetType: "offer",
      targetId: row.id,
      reason: action === "reject" ? (reason as string).trim() : "استوفى قائمة مراجعة الجودة",
      prevState: "pending_review",
      newState: row.status,
      meta: `price=${row.priceAmount}${row.currency}`,
    });
    return row;
  });

  if (!updated) {
    return NextResponse.json(
      { error: "تغيّرت حالة العرض أثناء المراجعة. حدّث الصفحة وأعد المحاولة." },
      { status: 409 },
    );
  }

  const ownerId = await accountIdForAgent(updated.agentId);
  if (ownerId) {
    void notify({
      accountId: ownerId,
      type: action === "approve" ? "offer_approved" : "offer_rejected",
      title: action === "approve" ? "عُرضك نُشر" : "لم يُعتمد عرضك",
      body:
        action === "approve"
          ? `«${updated.title}» منشور الآن لمدة ٩٠ يومًا — طلبات المسافرين تصل لوحتك مباشرة.`
          : `«${updated.title}» لم يُعتمد. السبب: ${updated.rejectionReason ?? "—"}. عدّل العرض وأعد إرساله.`,
      link: "/account",
      targetId: updated.id,
    });
  }

  return NextResponse.json({ offer: updated });
}

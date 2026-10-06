import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  contactRequests,
  offers,
  travelerIntentInquiries,
  travelerIntentOffers,
  travelerSavedIntents,
} from "@/db/schema";
import { accountFromCookies } from "@/lib/identity";
import { TravelerIntentForm } from "@/components/market/TravelerIntentForm";
import { savedReadinessFromSnapshot } from "@/lib/traveler-readiness-memory";

export const dynamic = "force-dynamic";

function snapshot(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function travelerTotal(intent: Record<string, unknown>): number {
  const t = snapshot(intent.travelers);
  return ["adults", "children", "infants"].reduce((sum, key) => {
    const value = Number(t[key] ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function dateTime(value: string | null): string {
  if (!value) return "غير مسجل";
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value)) + " UTC";
}

const freshnessLabel = {
  CURRENT: "صلاحية الأدلة مسجلة",
  ATTENTION: "يحتاج إعادة تحقق",
  UNKNOWN: "صلاحية الأدلة غير مكتملة",
} as const;

const changeLabel = {
  FIRST_CHECK: "أول فحص محفوظ",
  UNCHANGED: "لا تغيير منذ آخر فحص",
  CHANGED: "القرار تغيّر",
} as const;

export default async function TravelerWorkspacePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const initialDestination = typeof query.destination === "string" ? query.destination.slice(0, 80) : "";
  const initialLabel = initialDestination ? `رحلة إلى ${initialDestination}` : "";
  if (process.env.TRAVELER_WORKSPACE_ENABLED !== "true") notFound();

  const account = await accountFromCookies();
  if (!account) redirect("/join?mode=traveler");
  if (account.role !== "traveler") redirect("/account");

  const intents = await db
    .select()
    .from(travelerSavedIntents)
    .where(eq(travelerSavedIntents.accountId, account.id))
    .orderBy(desc(travelerSavedIntents.updatedAt))
    .limit(30);

  const ids = intents.map((intent) => intent.id);
  const selectedOffers = ids.length
    ? await db
        .select({
          savedIntentId: travelerIntentOffers.savedIntentId,
          offerId: offers.id,
          title: offers.title,
          currency: offers.currency,
          priceAmount: offers.priceAmount,
          status: offers.status,
        })
        .from(travelerIntentOffers)
        .innerJoin(offers, eq(travelerIntentOffers.offerId, offers.id))
        .where(inArray(travelerIntentOffers.savedIntentId, ids))
    : [];

  const inquiries = ids.length
    ? await db
        .select({
          savedIntentId: travelerIntentInquiries.savedIntentId,
          contactRequestId: contactRequests.id,
          status: contactRequests.status,
          offerId: contactRequests.offerId,
          createdAt: contactRequests.createdAt,
        })
        .from(travelerIntentInquiries)
        .innerJoin(contactRequests, eq(travelerIntentInquiries.contactRequestId, contactRequests.id))
        .where(inArray(travelerIntentInquiries.savedIntentId, ids))
    : [];

  const quoteStatuses = ids.length
    ? await pool.query<{
        saved_intent_id: number;
        delivery_status: string;
        response: string | null;
        expires_at: Date;
      }>(
        `SELECT ti.saved_intent_id,
                qd.status AS delivery_status,
                qd.response,
                qd.expires_at
           FROM traveler_intent_inquiries ti
           JOIN contact_requests cr ON cr.id = ti.contact_request_id
           JOIN agency_opportunities ao ON ao.source_contact_request_id = cr.id
           JOIN agency_quote_deliveries qd ON qd.opportunity_id = ao.id
          WHERE cr.traveler_account_id = $1
            AND ti.saved_intent_id = ANY($2::integer[])
          ORDER BY qd.created_at DESC`,
        [account.id, ids],
      )
    : { rows: [] as Array<{ saved_intent_id: number; delivery_status: string; response: string | null; expires_at: Date }> };

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-10 md:px-8">
      <div className="mb-10 sila-decision-zone">
        <div className="sila-eyebrow text-[11px] font-semibold text-signal">مساحة السفر الشخصية</div>
        <h1 className="mt-3 text-[clamp(2.35rem,5vw,4.4rem)] font-bold leading-[1.04] tracking-[-0.035em] text-inkwell">
          كل رحلة لها سياق.
          <span className="block text-slate">وكل سياق له خطوة تالية.</span>
        </h1>
        <p className="sila-copy-comfort mt-4 text-[15px] leading-8 text-slate">
          بدل ما الرحلة تبقى موزعة بين بحث، مقارنة ورسائل، صلة تجمعها في مسار واحد:
          اللي ثبتناه، اللي محتاج يتراجع، وإيه أهم حاجة تعملها دلوقتي.
        </p>

        <div className="mt-7 grid border-y border-outlinev sm:grid-cols-3 sm:divide-x sm:divide-x-reverse sm:divide-outlinev" aria-label="منطق مساحة السفر">
          {[
            ["01", "السياق", "رحلة واحدة بدل بيانات متناثرة."],
            ["02", "اليقين", "نفرّق بين المؤكد والمحتاج تحقق."],
            ["03", "الحركة", "نرفع خطوة واحدة بدل زحمة أزرار."],
          ].map(([step, title, text]) => (
            <div key={step} className="grid grid-cols-[38px_1fr] gap-3 py-4 sm:px-4">
              <div className="tnum text-[11px] font-bold text-signal">{step}</div>
              <div>
                <div className="text-[13px] font-bold text-deep">{title}</div>
                <div className="mt-1 text-[11px] leading-5 text-slate">{text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sila-decision-window overflow-hidden border-t-2 border-t-signal/55 p-5 md:p-7">
        <TravelerIntentForm initialDestination={initialDestination} initialLabel={initialLabel} />
        <p className="sila-reassurance mt-5 border-t border-outlinev pt-4">
          ابدأ بالمعلومات اللي عندك فقط. تقدر تعدّل الرحلة لاحقًا، ونقص البيانات يفضل واضح بدل ما يتحول لاستنتاج.
        </p>
      </div>

      <section className="mt-8 space-y-4">
        {intents.length === 0 ? (
          <div className="sila-window border border-dashed border-outlinev bg-cloud p-8 text-center text-sm text-slate">
            لم تحفظ نية سفر بعد.
          </div>
        ) : intents.map((intent) => {
          const data = snapshot(intent.intentSnapshot);
          const savedReadiness = savedReadinessFromSnapshot(data);
          const destinations = Array.isArray(data.destinations) ? data.destinations.map(String) : [];
          const origin = typeof data.originCity === "string" ? data.originCity : "";
          const total = travelerTotal(data);
          const intentOffers = selectedOffers.filter((row) => row.savedIntentId === intent.id);
          const intentInquiries = inquiries.filter((row) => row.savedIntentId === intent.id);
          const deliveries = quoteStatuses.rows.filter((row) => row.saved_intent_id === intent.id);
          const params = new URLSearchParams();
          if (origin) params.set("from", origin);
          if (destinations[0]) params.set("to", destinations[0]);
          if (total > 0) params.set("travelers", String(total));
          params.set("intentId", String(intent.id));

          const nextAction =
            !savedReadiness
              ? {
                  href: `/readiness?intentId=${intent.id}`,
                  label: "ابدأ فحص الجاهزية",
                  note: "نبدأ بما قد يمنع الرحلة أو يغيّر تجهيزاتها قبل البحث عن عروض.",
                  attention: "focus" as const,
                }
              : savedReadiness.freshness.status === "ATTENTION"
                ? {
                    href: `/readiness?intentId=${intent.id}`,
                    label: "أعد التحقق الآن",
                    note: "فيه معلومة قديمة أو تغيّر مؤثر؛ الأفضل تحديث القرار قبل أي خطوة تجارية.",
                    attention: "critical" as const,
                  }
                : intentOffers.length === 0
                  ? {
                      href: `/offers?${params.toString()}`,
                      label: "ابحث عن عروض مناسبة",
                      note: "سياق الرحلة جاهز. ننتقل الآن من الفهم إلى السوق بدون إعادة إدخال التفاصيل.",
                      attention: "focus" as const,
                    }
                  : intentInquiries.length === 0
                    ? {
                        href: `/compare?intentId=${intent.id}`,
                        label: "قارن قبل التواصل",
                        note: "لديك عروض محفوظة؛ قارنها أولًا حتى لا ترسل طلبًا تحت ضغط الاختيار.",
                        attention: "focus" as const,
                      }
                    : deliveries.length === 0
                      ? {
                          href: "/account",
                          label: "تابع طلب التواصل",
                          note: "طلبك مرتبط بهذه الرحلة بالفعل. لا تحتاج لإرسال طلب جديد.",
                          attention: "calm" as const,
                        }
                      : {
                          href: "/account",
                          label: "راجع آخر تحديث",
                          note: "هناك تحديث تجاري مرتبط بالرحلة؛ راجعه قبل اتخاذ خطوة أخرى.",
                          attention: "focus" as const,
                        };

          return (
            <article key={intent.id} className="overflow-hidden rounded-[1.6rem] border border-outlinev bg-cloud">
              <div className="p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xl font-bold tracking-[-0.02em] text-inkwell md:text-2xl">{intent.label}</div>
                    <div className="mt-3 flex min-w-0 items-center gap-2 text-[12px] text-slate">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-signal" />
                      <span className="truncate">{origin || "انطلاق غير محدد"}</span>
                      <span className="h-px min-w-6 flex-1 bg-outlinev" aria-hidden="true" />
                      <span className="truncate">{destinations.join("، ") || "وجهة غير محددة"}</span>
                      <span className="h-2 w-2 shrink-0 rounded-full bg-sky" />
                    </div>
                    {total > 0 ? <div className="mt-2 text-[11px] font-medium text-slate">{total} مسافر</div> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {savedReadiness ? (
                      <span className={
                        "rounded-full px-3 py-1 text-[11px] font-bold " +
                        (savedReadiness.freshness.status === "ATTENTION"
                          ? "bg-amber text-gold"
                          : savedReadiness.freshness.status === "CURRENT"
                            ? "bg-verifiedbg text-verified"
                            : "bg-low text-slate")
                      }>
                        {freshnessLabel[savedReadiness.freshness.status]}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-low px-3 py-1 text-[11px] font-bold text-slate">
                      {intent.status === "active" ? "نشطة" : "مؤرشفة"}
                    </span>
                  </div>
                </div>

                <div className="sila-decision-window mt-6 p-4 md:flex md:items-center md:justify-between md:gap-5" data-attention={nextAction.attention}>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-signal">الخطوة التالية</div>
                    <p className="mt-1 max-w-xl text-[12px] leading-6 text-slate">{nextAction.note}</p>
                  </div>
                  <Link href={nextAction.href} className="sila-attention-primary mt-3 shrink-0 md:mt-0">
                    {nextAction.label}
                  </Link>
                </div>

                <details className="sila-progressive mt-3">
                  <summary>كل الأدوات الخاصة بهذه الرحلة</summary>
                  <div className="flex flex-wrap gap-2 p-3">
                    <Link href={`/offers?${params.toString()}`} className="rounded-xl bg-cloud px-4 py-2 text-[12px] font-bold text-deep ring-1 ring-outlinev">
                      العروض
                    </Link>
                    <Link href={`/compare?intentId=${intent.id}`} className="rounded-xl bg-cloud px-4 py-2 text-[12px] font-bold text-deep ring-1 ring-outlinev">
                      المقارنة
                    </Link>
                    <Link href={`/readiness?intentId=${intent.id}`} className="rounded-xl bg-cloud px-4 py-2 text-[12px] font-bold text-deep ring-1 ring-outlinev">
                      {savedReadiness ? "إعادة فحص الجاهزية" : "فحص الجاهزية"}
                    </Link>
                  </div>
                </details>
              </div>

              <div className="border-y border-outlinev bg-low/45 px-5 py-4 md:px-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-deep">ذاكرة الرحلة</div>
                  {savedReadiness ? <div className="text-[10px] text-slate">آخر فحص · {dateTime(savedReadiness.checkedAt)}</div> : null}
                </div>
                {savedReadiness ? (
                  <div className="mt-3 grid gap-3 text-[11px] leading-5 text-slate sm:grid-cols-3">
                    <div>
                      <span className="font-bold text-inkwell">التغيّر: </span>
                      {changeLabel[savedReadiness.change.state]}
                    </div>
                    <div>
                      <span className="font-bold text-inkwell">صلاحية المعلومات: </span>
                      {freshnessLabel[savedReadiness.freshness.status]}
                    </div>
                    <div>
                      <span className="font-bold text-inkwell">التفسير: </span>
                      {savedReadiness.freshness.reasons.join(" ") || "لا توجد ملاحظات إضافية."}
                    </div>
                    {savedReadiness.change.changedKeys.length ? (
                      <div className="sm:col-span-3">
                        <span className="font-bold text-gold">اتغيّر: </span>
                        {savedReadiness.change.changedKeys.join(" · ")}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-[12px] leading-6 text-slate">
                    لسه مفيش فحص جاهزية محفوظ. أول فحص هيبقى نقطة المقارنة لأي تغيير بعد كده.
                  </p>
                )}
              </div>

              <div className="grid md:grid-cols-3 md:divide-x md:divide-x-reverse md:divide-outlinev">
                <div className="p-5 md:p-6">
                  <div className="text-[11px] font-bold text-deep">عروض للمقارنة</div>
                  <div className="mt-3 space-y-3">
                    {intentOffers.length ? intentOffers.map((row) => (
                      <Link key={row.offerId} href={`/offers/${row.offerId}?intentId=${intent.id}`} className="group flex items-center justify-between gap-3 text-[12px] font-semibold text-deep">
                        <span>{row.title}</span>
                        <span className="text-signal transition-transform group-hover:-translate-x-1" aria-hidden="true">←</span>
                      </Link>
                    )) : <p className="text-[12px] leading-6 text-slate">لسه ما حفظتش عرض للمقارنة.</p>}
                  </div>
                </div>

                <div className="border-t border-outlinev p-5 md:border-t-0 md:p-6">
                  <div className="text-[11px] font-bold text-deep">طلبات التواصل</div>
                  <div className="mt-3 space-y-2">
                    {intentInquiries.length ? intentInquiries.map((row) => (
                      <div key={row.contactRequestId} className="flex items-center justify-between gap-3 text-[12px] text-slate">
                        <span className="tnum font-semibold text-deep">TRQ-{String(row.contactRequestId).padStart(4, "0")}</span>
                        <span>{row.status}</span>
                      </div>
                    )) : <p className="text-[12px] leading-6 text-slate">مافيش طلب تواصل مرتبط بالرحلة دي.</p>}
                  </div>
                </div>

                <div className="border-t border-outlinev p-5 md:border-t-0 md:p-6">
                  <div className="text-[11px] font-bold text-deep">تحديثات الأسعار</div>
                  <div className="mt-3 space-y-2">
                    {deliveries.length ? deliveries.map((row, index) => (
                      <div key={`${row.delivery_status}-${index}`} className="text-[12px] leading-6 text-slate">
                        <span className="font-semibold text-deep">{row.delivery_status}</span>
                        {row.response ? ` · ${row.response}` : ""}
                      </div>
                    )) : <p className="text-[12px] leading-6 text-slate">لسه ما وصلش Quote مرتبط بالرحلة.</p>}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

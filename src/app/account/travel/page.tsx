import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft, Check, CircleHelp, RefreshCcw } from "lucide-react";
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
  const travelers = snapshot(intent.travelers);
  return ["adults", "children", "infants"].reduce((sum, key) => {
    const value = Number(travelers[key] ?? 0);
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
  CURRENT: "الأدلة الحالية لها صلاحية مسجلة",
  ATTENTION: "معلومة تحتاج إعادة تحقق",
  UNKNOWN: "صلاحية الأدلة غير مكتملة",
} as const;

const changeLabel = {
  FIRST_CHECK: "هذا أول فحص محفوظ",
  UNCHANGED: "لا تغيير مهم منذ آخر فحص",
  CHANGED: "القرار تغيّر منذ آخر فحص",
} as const;

export default async function TravelerWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
    <main className="mx-auto max-w-[1180px] px-5 pb-24 pt-9 md:px-8 md:pt-12">
      <header className="border-b border-outlinev pb-9">
        <div className="sila-eyebrow text-[11px] font-bold">Traveler Memory</div>
        <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-[-0.04em] text-deep md:text-6xl">
          رحلتك لا تبدأ من الصفر كل مرة.
        </h1>
        <p className="mt-5 max-w-[680px] text-[15px] leading-8 text-slate">
          صلة تحتفظ بسياق الرحلة نفسها: ما عرفناه، ما تحققنا منه، العروض التي حفظتها،
          وطلبات التواصل—ثم ترفع لك خطوة واحدة باعتبارها الأهم الآن.
        </p>
      </header>

      <details className="progressive-panel mt-6">
        <summary>احفظ رحلة جديدة أو سياقًا جديدًا</summary>
        <div className="pb-8 pt-2">
          <TravelerIntentForm initialDestination={initialDestination} initialLabel={initialLabel} />
        </div>
      </details>

      <section className="mt-9 space-y-8">
        {intents.length === 0 ? (
          <div className="border-y border-outlinev py-12">
            <div className="decision-state decision-state--unknown">لا توجد رحلة محفوظة</div>
            <h2 className="mt-4 text-2xl font-bold text-deep">ابدأ بسياق واحد، مش بكل التفاصيل.</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate">
              احفظ الوجهة أو الفكرة الأساسية فقط، وبعدها مستشار صلة يكمل معك السؤال التالي.
            </p>
            <Link href="/readiness" className="focus-action mt-6">
              ابدأ رحلتك
              <ArrowLeft className="h-4 w-4" />
            </Link>
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
                  label: "ابدأ التحقق",
                  href: `/readiness?intentId=${intent.id}`,
                  note: "لسه ما عندناش فحص محفوظ لهذه الرحلة.",
                  tone: "focus" as const,
                }
              : savedReadiness.freshness.status === "ATTENTION"
                ? {
                    label: "أعد التحقق الآن",
                    href: `/readiness?intentId=${intent.id}`,
                    note: "في معلومة محفوظة تحتاج إعادة تحقق قبل الاعتماد عليها.",
                    tone: "critical" as const,
                  }
                : intentOffers.length === 0
                  ? {
                      label: "ابحث عن عرض حقيقي",
                      href: `/offers?${params.toString()}`,
                      note: "السياق محفوظ، لكنك لم تحفظ عرضًا للمقارنة بعد.",
                      tone: "focus" as const,
                    }
                  : intentInquiries.length === 0
                    ? {
                        label: intentOffers.length > 1 ? "قارن العروض" : "راجع العرض",
                        href: intentOffers.length > 1
                          ? `/compare?intentId=${intent.id}`
                          : `/offers/${intentOffers[0].offerId}?intentId=${intent.id}`,
                        note: "عندك عرض محفوظ؛ راجعه أو قارنه قبل التواصل.",
                        tone: "focus" as const,
                      }
                    : deliveries.length === 0
                      ? {
                          label: "راجع طلب التواصل",
                          href: `/offers/${intentInquiries[0].offerId}?intentId=${intent.id}`,
                          note: "تم إرسال طلب تواصل، ولم يصل تحديث Quote مرتبط بعد.",
                          tone: "calm" as const,
                        }
                      : {
                          label: "راجع آخر تحديث",
                          href: `#updates-${intent.id}`,
                          note: "وصل تحديث مرتبط بطلبك. راجعه قبل أي خطوة جديدة.",
                          tone: "focus" as const,
                        };

          return (
            <article key={intent.id} id={`intent-${intent.id}`} className="decision-board">
              <div className="p-5 md:p-7">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-signal">رحلتك</div>
                    <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-deep md:text-3xl">
                      {intent.label}
                    </h2>
                    <div className="intent-route mt-4 max-w-xl">
                      <span className="intent-route__point truncate">{origin || "انطلاق غير محدد"}</span>
                      <span className="intent-route__line" />
                      <span className="intent-route__point truncate">{destinations[0] || "وجهة غير محددة"}</span>
                    </div>
                    {total > 0 ? <div className="mt-2 text-[11px] text-slate">{total} مسافر</div> : null}
                  </div>

                  <span className={
                    "decision-state " +
                    (nextAction.tone === "critical"
                      ? "decision-state--conflicting"
                      : nextAction.tone === "focus"
                        ? "decision-state--focus"
                        : "decision-state--unknown")
                  }>
                    {intent.status === "active" ? "رحلة نشطة" : "مؤرشفة"}
                  </span>
                </div>

                <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_330px]">
                  <div>
                    <div className="text-[11px] font-bold text-deep">آخر ما توصلنا إليه</div>
                    {savedReadiness ? (
                      <div className="mt-3 border-y border-outlinev">
                        <div className="grid grid-cols-[24px_1fr] gap-3 py-4">
                          {savedReadiness.freshness.status === "CURRENT" ? (
                            <Check className="mt-1 h-4 w-4 text-verified" />
                          ) : savedReadiness.freshness.status === "ATTENTION" ? (
                            <RefreshCcw className="mt-1 h-4 w-4 text-gold" />
                          ) : (
                            <CircleHelp className="mt-1 h-4 w-4 text-slate" />
                          )}
                          <div>
                            <div className="text-sm font-bold text-deep">
                              {freshnessLabel[savedReadiness.freshness.status]}
                            </div>
                            <div className="mt-1 text-[11px] leading-5 text-slate">
                              {changeLabel[savedReadiness.change.state]} · آخر فحص {dateTime(savedReadiness.checkedAt)}
                            </div>
                          </div>
                        </div>
                        {savedReadiness.freshness.reasons.length ? (
                          <div className="border-t border-outlinev py-4 text-[12px] leading-6 text-slate">
                            {savedReadiness.freshness.reasons.join(" ")}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-3 border-y border-outlinev py-5 text-sm text-slate">
                        لا توجد نتيجة تحقق محفوظة بعد.
                      </div>
                    )}
                  </div>

                  <div className="border-t-2 border-signal bg-air/45 p-5">
                    <div className="text-[10px] font-bold text-signal">الخطوة التالية</div>
                    <p className="mt-3 text-[13px] leading-6 text-slate">{nextAction.note}</p>
                    <Link href={nextAction.href} className="focus-action mt-5 w-full">
                      {nextAction.label}
                      <ArrowLeft className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>

              <details className="progressive-panel border-t border-outlinev px-5 md:px-7">
                <summary>كل تفاصيل الرحلة المحفوظة</summary>
                <div className="grid gap-6 border-t border-outlinev py-6 md:grid-cols-3">
                  <div>
                    <div className="text-[11px] font-bold text-deep">عروض للمقارنة</div>
                    <div className="mt-3 space-y-2">
                      {intentOffers.length ? intentOffers.map((row) => (
                        <Link
                          key={row.offerId}
                          href={`/offers/${row.offerId}?intentId=${intent.id}`}
                          className="block text-[12px] font-semibold leading-6 text-deep hover:text-signal"
                        >
                          {row.title}
                        </Link>
                      )) : <p className="text-[12px] text-slate">لا توجد عروض محفوظة.</p>}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold text-deep">طلبات التواصل</div>
                    <div className="mt-3 space-y-2">
                      {intentInquiries.length ? intentInquiries.map((row) => (
                        <div key={row.contactRequestId} className="text-[12px] leading-6 text-slate">
                          <span className="tnum font-bold text-deep">TRQ-{String(row.contactRequestId).padStart(4, "0")}</span>
                          {" · "}{row.status}
                        </div>
                      )) : <p className="text-[12px] text-slate">لا يوجد طلب تواصل مرتبط.</p>}
                    </div>
                  </div>

                  <div id={`updates-${intent.id}`}>
                    <div className="text-[11px] font-bold text-deep">تحديثات Quote</div>
                    <div className="mt-3 space-y-2">
                      {deliveries.length ? deliveries.map((row, index) => (
                        <div key={`${row.delivery_status}-${index}`} className="text-[12px] leading-6 text-slate">
                          <span className="font-bold text-deep">{row.delivery_status}</span>
                          {row.response ? ` · ${row.response}` : ""}
                        </div>
                      )) : <p className="text-[12px] text-slate">لا يوجد تحديث مرتبط بعد.</p>}
                    </div>
                  </div>
                </div>
              </details>
            </article>
          );
        })}
      </section>
    </main>
  );
}

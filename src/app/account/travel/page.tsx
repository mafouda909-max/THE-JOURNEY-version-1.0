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
      <div className="mb-8">
        <div className="sila-eyebrow text-[11px] font-semibold text-signal">Personal Travel Workspace</div>
        <h1 className="mt-2 text-3xl font-bold text-inkwell">رحلاتك المحفوظة من النية إلى العرض والطلب.</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate">
          نية السفر تظل ملك حسابك. احفظ السياق، اجمع حتى أربعة عروض للمقارنة، ثم اربط طلب التواصل بنفس النية حتى يظهر تقدمها بدون خلط الرحلات ببعض.
        </p>
      </div>

      <TravelerIntentForm initialDestination={initialDestination} initialLabel={initialLabel} />

      <section className="mt-8 space-y-4">
        {intents.length === 0 ? (
          <div className="sila-window border border-dashed border-outlinev bg-cloud p-8 text-center text-sm text-slate">
            لم تحفظ نية سفر بعد.
          </div>
        ) : intents.map((intent) => {
          const data = snapshot(intent.intentSnapshot);
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

          return (
            <article key={intent.id} className="sila-window border border-outlinev bg-cloud p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-inkwell">{intent.label}</div>
                  <div className="mt-1 text-[12px] text-slate">
                    {origin || "انطلاق غير محدد"} ← {destinations.join("، ")}
                    {total > 0 ? ` · ${total} مسافر` : ""}
                  </div>
                </div>
                <span className="rounded-full bg-low px-3 py-1 text-[11px] font-bold text-slate">
                  {intent.status === "active" ? "نشطة" : "مؤرشفة"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/offers?${params.toString()}`} className="rounded-xl bg-deep px-4 py-2 text-[12px] font-bold text-white">
                  ابحث عن عروض
                </Link>
                <Link href={`/compare?intentId=${intent.id}`} className="rounded-xl bg-air px-4 py-2 text-[12px] font-bold text-deep">
                  قارن الرحلات
                </Link>
                <Link href={`/readiness?intentId=${intent.id}`} className="rounded-xl bg-low px-4 py-2 text-[12px] font-bold text-deep">
                  افحص الجاهزية
                </Link>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-[11px] font-semibold text-slate">عروض محفوظة للمقارنة</div>
                  <div className="mt-2 space-y-2">
                    {intentOffers.length ? intentOffers.map((row) => (
                      <Link key={row.offerId} href={`/offers/${row.offerId}?intentId=${intent.id}`} className="block rounded-xl border border-outlinev p-3 text-[12px] font-semibold text-deep">
                        {row.title}
                      </Link>
                    )) : <p className="text-[12px] text-slate">لا توجد عروض محفوظة بعد.</p>}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate">طلبات التواصل</div>
                  <div className="mt-2 space-y-2">
                    {intentInquiries.length ? intentInquiries.map((row) => (
                      <div key={row.contactRequestId} className="rounded-xl border border-outlinev p-3 text-[12px] text-slate">
                        TRQ-{String(row.contactRequestId).padStart(4, "0")} · {row.status}
                      </div>
                    )) : <p className="text-[12px] text-slate">لم يُرسل طلب مرتبط بهذه النية.</p>}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate">حالة عروض الأسعار</div>
                  <div className="mt-2 space-y-2">
                    {deliveries.length ? deliveries.map((row, index) => (
                      <div key={`${row.delivery_status}-${index}`} className="rounded-xl border border-outlinev p-3 text-[12px] text-slate">
                        {row.delivery_status}{row.response ? ` · ${row.response}` : ""}
                      </div>
                    )) : <p className="text-[12px] text-slate">لا يوجد Quote مُسلّم مرتبط بعد.</p>}
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

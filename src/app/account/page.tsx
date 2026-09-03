import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { AlertTriangle, BadgeCheck, Clock3, Hourglass, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { agents, contactRequests, notifications, offers } from "@/db/schema";
import { accountFromCookies } from "@/lib/identity";
import { formatMoney, timeAgo, tripTypeLabel, PRICE_TYPE_LABELS } from "@/lib/format";
import { LogoutButton, MarkAllRead } from "@/components/AccountDock";
import { AccountOfferForm } from "@/components/AccountOfferForm";
import { Bell } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "حسابي",
  robots: { index: false },
};

const STATUS_UI: Record<string, { label: string; cls: string; note: string }> = {
  pending: {
    label: "قيد التقديم",
    cls: "bg-low text-slate",
    note: "ملفك وصل فريق الثقة — عليك أن تكمل بياناتك، وقرار المراجعة يصلك خلال ٤٨ ساعة.",
  },
  in_review: {
    label: "قيد المراجعة",
    cls: "bg-amber text-gold",
    note: "فريق الثقة يراجع ملفك الآن. القرار النهائي يوثَّق ويصل إليك.",
  },
  verified: {
    label: "وكيل موثّق",
    cls: "bg-verifiedbg text-verified",
    note: "ملفك العام مرئي للمسافرين، وعروضك تدخل طابور مراجعة العروض قبل النشر.",
  },
  rejected: {
    label: "مرفوض — يمكن إعادة التقديم",
    cls: "bg-errorbg text-error",
    note: "راجع سبب الرفض الموثق، حسّن الملف، وأعد التقديم بعد ٣٠ يوماً.",
  },
  suspended: {
    label: "موقوف",
    cls: "bg-errorbg text-error",
    note: "حسابك موقوف مؤقتاً بقرار موثق. راسل الدعم لمراجعة القرار.",
  },
};

export default async function AccountPage() {
  const account = await accountFromCookies();
  if (!account) redirect("/join");

  let agent = null;
  let myOffers: typeof offers.$inferSelect[] = [];
  let myLeads: typeof contactRequests.$inferSelect[] = [];

  if (account.role === "agent" && account.agentId) {
    const rows = await db.select().from(agents).where(eq(agents.id, account.agentId)).limit(1);
    agent = rows[0] ?? null;
    if (agent) {
      myOffers = await db
        .select()
        .from(offers)
        .where(eq(offers.agentId, agent.id))
        .orderBy(desc(offers.createdAt))
        .limit(20);
      myLeads = await db
        .select()
        .from(contactRequests)
        .where(eq(contactRequests.agentId, agent.id))
        .orderBy(desc(contactRequests.createdAt))
        .limit(20);
    }
  } else if (account.role === "traveler") {
    myLeads = await db
      .select()
      .from(contactRequests)
      .where(eq(contactRequests.travelerEmail, account.email))
      .orderBy(desc(contactRequests.createdAt))
      .limit(20);
  }

  const myNotifications = await db
    .select()
    .from(notifications)
    .where(eq(notifications.accountId, account.id))
    .orderBy(desc(notifications.createdAt))
    .limit(15);
  const unread = myNotifications.filter((n) => !n.readAt).length;

  const statusUi = agent ? STATUS_UI[agent.verificationStatus] ?? STATUS_UI.pending : null;
  const leadStatus: Record<string, string> = {
    new: "جديد",
    viewed: "شوهد",
    responded: "تم الرد",
    closed: "مغلق",
  };

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-10 md:px-8">
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-inkwell md:text-4xl">مرحباً، {account.displayName}</h1>
          <p className="mt-1.5 font-mono text-[12px] text-slate">
            {account.email} · {account.role === "agent" ? "حساب وكيل" : account.role === "admin" ? "إدارة" : "حساب مسافر"}
          </p>
        </div>
        <LogoutButton />
      </div>

      {agent && statusUi && (
        <div className={`mb-10 flex items-start gap-4 rounded-2xl border border-outlinev p-6 ${statusUi.cls} bg-opacity-100`}>
          {agent.verificationStatus === "verified" ? (
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0" />
          ) : agent.verificationStatus === "in_review" ? (
            <Hourglass className="mt-0.5 h-6 w-6 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
          )}
          <div>
            <div className="text-lg font-bold">حالة التوثيق: {statusUi.label}</div>
            <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed opacity-80">{statusUi.note}</p>
          </div>
        </div>
      )}

      {myNotifications.length > 0 && (
        <section className="mb-10 rounded-2xl border border-outlinev bg-cloud p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold text-inkwell">
              <Bell className="h-5 w-5 text-deep" />
              الإشعارات
              {unread > 0 && (
                <span className="tnum rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-white">
                  {unread}
                </span>
              )}
            </h2>
            {unread > 0 && <MarkAllRead />}
          </div>
          <div className="space-y-3">
            {myNotifications.slice(0, 6).map((n) => (
              <div
                key={n.id}
                className={`rounded-lg border p-4 ${n.readAt ? "border-low bg-low/40" : "border-wash bg-wash/50"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-bold text-inkwell">{n.title}</span>
                  <span className="font-mono text-[10px] text-slate/60">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate">{n.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {account.role === "agent" && agent && (
        <>
          {agent.verificationStatus === "verified" && (
            <div className="mb-8">
              <AccountOfferForm />
            </div>
          )}
          <section className="mb-12">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-inkwell">عروضي ({myOffers.length})</h2>
            </div>
            {agent.verificationStatus !== "verified" ? (
              <div className="rounded-xl border border-dashed border-outlinev bg-cloud px-6 py-10 text-center text-[14px] text-slate">
                نشر العروض يتاح بعد اعتماد التوثيق — هذه القاعدة تحمي المسافر قبل الوكيل.
              </div>
            ) : myOffers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-outlinev bg-cloud px-6 py-10 text-center">
                <p className="font-bold text-inkwell">لا عروض بعد.</p>
                <p className="mt-2 text-sm text-slate">
                  عروضك تُنشأ عبر فريق المنصة في هذه المرحلة — راسلنا وسيُدخل أول عرض لك في طابور المراجعة.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myOffers.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outlinev bg-cloud p-4">
                    <div>
                      <div className="font-bold text-inkwell">{o.title}</div>
                      <div className="mt-1 text-[12px] text-slate">
                        {tripTypeLabel(o.tripType)} · <span className="tnum">{formatMoney(o.priceAmount, o.currency)}</span> {PRICE_TYPE_LABELS[o.priceType]}
                        {o.status === "rejected" && o.rejectionReason && (
                          <span className="ms-2 text-error">مرفوض: {o.rejectionReason.slice(0, 80)}…</span>
                        )}
                      </div>
                    </div>
                    <span className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${
                      o.status === "published" ? "bg-verifiedbg text-verified" : o.status === "pending_review" ? "bg-amber text-gold" : "bg-low text-slate"
                    }`}>
                      {o.status === "published" ? "منشور" : o.status === "pending_review" ? "قيد المراجعة" : o.status === "rejected" ? "مرفوض" : o.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-5 text-2xl font-bold text-inkwell">طلبات التواصل الواردة ({myLeads.length})</h2>
            {myLeads.length === 0 ? (
              <div className="rounded-xl border border-dashed border-outlinev bg-cloud px-6 py-8 text-center text-sm text-slate">
                لا طلبات بعد — تظهر هنا فور وصولها مع تنبيهك.
              </div>
            ) : (
              <div className="space-y-3">
                {myLeads.map((l) => (
                  <div key={l.id} className="rounded-xl border border-outlinev bg-cloud p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-inkwell">{l.travelerName}</div>
                      <span className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${l.status === "new" ? "bg-amber text-gold" : "bg-low text-slate"}`}>
                        {leadStatus[l.status] ?? l.status}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-slate">{timeAgo(l.createdAt)} · {l.travelerCount} مسافرين · {l.travelDates ?? "تواريخ مفتوحة"}</div>
                    <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-slate">{l.message}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {account.role === "traveler" && (
        <section>
          <h2 className="mb-5 text-2xl font-bold text-inkwell">طلباتي المرسلة ({myLeads.length})</h2>
          {myLeads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outlinev bg-cloud px-6 py-10 text-center">
              <p className="font-bold text-inkwell">لم ترسل طلبات بعد.</p>
              <Link href="/offers" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-deep px-5 py-2.5 text-sm font-bold text-white hover:bg-horizon">
                <BadgeCheck className="h-4 w-4" />
                تصفّح العروض الموثّقة
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {myLeads.map((l) => (
                <div key={l.id} className="rounded-xl border border-outlinev bg-cloud p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/offers/${l.offerId}`} className="font-bold text-deep hover:underline">
                      طلب #{l.id} — تفاصيل العرض
                    </Link>
                    <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold ${l.status === "new" ? "bg-amber text-gold" : l.status === "responded" ? "bg-verifiedbg text-verified" : "bg-low text-slate"}`}>
                      <Clock3 className="h-3 w-3" />
                      {leadStatus[l.status] ?? l.status}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-slate">{timeAgo(l.createdAt)} · {l.travelDates ?? "تواريخ مفتوحة"}</div>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-slate">{l.message}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

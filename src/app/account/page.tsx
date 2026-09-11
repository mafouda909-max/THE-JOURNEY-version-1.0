import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  Clock3,
  Hourglass,
  ShieldCheck,
} from "lucide-react";
import { db } from "@/db";
import { agents, contactRequests, notifications, offers } from "@/db/schema";
import { accountFromCookies } from "@/lib/identity";
import { formatMoney, timeAgo, tripTypeLabel, PRICE_TYPE_LABELS } from "@/lib/format";
import { LogoutButton, MarkAllRead } from "@/components/AccountDock";
import { AccountOfferForm } from "@/components/AccountOfferForm";
import { AgentLeadActions } from "@/components/AgentLeadActions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "حسابي",
  robots: { index: false },
};

const STATUS_UI: Record<string, { label: string; cls: string; note: string }> = {
  pending: {
    label: "قيد التقديم",
    cls: "bg-low text-slate",
    note: "أكمل ملف التوثيق وارفع الأدلة المطلوبة حتى يتمكن فريق الثقة من بدء المراجعة.",
  },
  in_review: {
    label: "قيد المراجعة",
    cls: "bg-amber/20 text-gold",
    note: "فريق الثقة يراجع ملفك الآن. إذا طُلب تصحيح أو صدر قرار فسيظهر لك هنا وفي الإشعارات.",
  },
  verified: {
    label: "وكيل موثّق",
    cls: "bg-verifiedbg text-verified",
    note: "ملفك مؤهل للظهور للمسافرين، وكل عرض جديد يمر بمراجعة مستقلة قبل نشره.",
  },
  rejected: {
    label: "يحتاج إلى تصحيح",
    cls: "bg-errorbg text-error",
    note: "راجع أسباب الرفض في ملف التوثيق، صحّح البيانات أو المستندات المطلوبة، ثم أعد الإرسال للمراجعة.",
  },
  suspended: {
    label: "موقوف",
    cls: "bg-errorbg text-error",
    note: "حسابك موقوف مؤقتاً بقرار موثق. راسل الدعم لمراجعة القرار.",
  },
};

const LEAD_STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "جديد", cls: "bg-amber/20 text-gold" },
  viewed: { label: "تم الاطلاع", cls: "bg-low text-slate" },
  responded: { label: "تم الرد", cls: "bg-verifiedbg text-verified" },
  closed: { label: "مغلق", cls: "bg-low text-slate" },
};

function leadStatus(status: string) {
  return LEAD_STATUS[status] ?? { label: status, cls: "bg-low text-slate" };
}

export default async function AccountPage() {
  const account = await accountFromCookies();
  if (!account) redirect("/join");

  let agent: typeof agents.$inferSelect | null = null;
  let myOffers: typeof offers.$inferSelect[] = [];
  let myLeads: typeof contactRequests.$inferSelect[] = [];

  if (account.role === "agent" && account.agentId) {
    const rows = await db.select().from(agents).where(eq(agents.id, account.agentId)).limit(1);
    agent = rows[0] ?? null;
    if (agent) {
      [myOffers, myLeads] = await Promise.all([
        db
          .select()
          .from(offers)
          .where(eq(offers.agentId, agent.id))
          .orderBy(desc(offers.createdAt))
          .limit(20),
        db
          .select()
          .from(contactRequests)
          .where(eq(contactRequests.agentId, agent.id))
          .orderBy(desc(contactRequests.createdAt))
          .limit(20),
      ]);
    }
  } else if (account.role === "traveler") {
    // Fail-closed ownership: show only requests explicitly bound at creation
    // time to this authenticated account. Never infer ownership from email.
    myLeads = await db
      .select()
      .from(contactRequests)
      .where(eq(contactRequests.travelerAccountId, account.id))
      .orderBy(desc(contactRequests.createdAt))
      .limit(20);
  }

  const myNotifications = await db
    .select()
    .from(notifications)
    .where(eq(notifications.accountId, account.id))
    .orderBy(desc(notifications.createdAt))
    .limit(15);
  const unread = myNotifications.filter((notification) => !notification.readAt).length;
  const statusUi = agent ? STATUS_UI[agent.verificationStatus] ?? STATUS_UI.pending : null;

  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-10 md:px-8">
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-inkwell md:text-4xl">مرحباً، {account.displayName}</h1>
          <p className="mt-1.5 font-mono text-[12px] text-slate" dir="ltr">
            {account.email}
          </p>
          <p className="mt-1 text-xs text-slate">
            {account.role === "agent" ? "حساب وكيل" : account.role === "admin" ? "حساب إدارة" : "حساب مسافر"}
          </p>
        </div>
        <LogoutButton />
      </div>

      {agent && statusUi && (
        <section className={`mb-10 flex items-start gap-4 rounded-2xl border border-outlinev p-6 ${statusUi.cls}`} aria-labelledby="verification-status-heading">
          {agent.verificationStatus === "verified" ? (
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
          ) : agent.verificationStatus === "in_review" ? (
            <Hourglass className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <h2 id="verification-status-heading" className="text-lg font-bold">حالة التوثيق: {statusUi.label}</h2>
            <p className="mt-1.5 max-w-2xl text-[14px] leading-7 opacity-85">{statusUi.note}</p>
            {agent.verificationStatus !== "verified" && (
              <Link
                href="/account/verification"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-deep px-4 py-2.5 text-[13px] font-bold text-white hover:bg-horizon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep focus-visible:ring-offset-2"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                مراجعة ملف التوثيق
              </Link>
            )}
          </div>
        </section>
      )}

      {myNotifications.length > 0 && (
        <section className="mb-10 rounded-2xl border border-outlinev bg-cloud p-5 md:p-6" aria-labelledby="notifications-heading">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="notifications-heading" className="flex items-center gap-2 text-xl font-bold text-inkwell">
              <Bell className="h-5 w-5 text-deep" aria-hidden="true" />
              الإشعارات
              {unread > 0 && <span className="tnum rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-white">{unread}</span>}
            </h2>
            {unread > 0 && <MarkAllRead />}
          </div>
          <div className="space-y-3">
            {myNotifications.slice(0, 6).map((notification) => (
              <div key={notification.id} className={`rounded-lg border p-4 ${notification.readAt ? "border-low bg-low/40" : "border-wash bg-wash/50"}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[14px] font-bold text-inkwell">{notification.title}</span>
                  <span className="shrink-0 font-mono text-[10px] text-slate/60">{timeAgo(notification.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-7 text-slate">{notification.body}</p>
                {notification.link && (
                  <Link href={notification.link} className="mt-2 inline-flex text-xs font-bold text-deep hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep">
                    فتح التفاصيل
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {account.role === "agent" && agent && (
        <>
          {agent.verificationStatus === "verified" && (
            <section className="mb-8" aria-label="إنشاء عرض جديد">
              <AccountOfferForm />
            </section>
          )}

          <section className="mb-12" aria-labelledby="offers-heading">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 id="offers-heading" className="text-2xl font-bold text-inkwell">عروضي ({myOffers.length})</h2>
            </div>
            {agent.verificationStatus !== "verified" ? (
              <div className="rounded-xl border border-dashed border-outlinev bg-cloud px-6 py-10 text-center text-[14px] leading-7 text-slate">
                إنشاء العروض وإعادة إرسالها يتاحان بعد اعتماد التوثيق. أكمل ملف الثقة أولاً.
              </div>
            ) : myOffers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-outlinev bg-cloud px-6 py-10 text-center">
                <p className="font-bold text-inkwell">لا عروض بعد.</p>
                <p className="mt-2 text-sm leading-7 text-slate">استخدم زر «إنشاء عرض جديد» أعلاه. سيصل العرض إلى المراجعة أولاً ولن يظهر للمسافرين قبل الاعتماد.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myOffers.map((offer) => {
                  const statusClass = offer.status === "published"
                    ? "bg-verifiedbg text-verified"
                    : offer.status === "pending_review"
                      ? "bg-amber/20 text-gold"
                      : offer.status === "rejected"
                        ? "bg-errorbg text-error"
                        : "bg-low text-slate";
                  const statusLabel = offer.status === "published"
                    ? "منشور"
                    : offer.status === "pending_review"
                      ? "قيد المراجعة"
                      : offer.status === "rejected"
                        ? "مرفوض — يحتاج تعديل"
                        : offer.status;
                  return (
                    <article key={offer.id} className="rounded-xl border border-outlinev bg-cloud p-4 md:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-bold text-inkwell">{offer.title}</h3>
                          <p className="mt-1 text-[12px] leading-6 text-slate">
                            {tripTypeLabel(offer.tripType)} · <span className="tnum">{formatMoney(offer.priceAmount, offer.currency)}</span> {PRICE_TYPE_LABELS[offer.priceType] ?? offer.priceType}
                          </p>
                        </div>
                        <span className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${statusClass}`}>{statusLabel}</span>
                      </div>

                      {offer.status === "rejected" && (
                        <div className="mt-4 rounded-lg border border-error/20 bg-errorbg/60 p-4">
                          <p className="text-xs font-bold text-error">سبب الرفض</p>
                          <p className="mt-1 text-sm leading-7 text-slate">{offer.rejectionReason ?? "لم يُسجل سبب واضح. راجع الإشعار أو تواصل مع فريق الثقة."}</p>
                          <div className="mt-4">
                            <AccountOfferForm offer={offer} />
                          </div>
                        </div>
                      )}

                      {offer.status === "pending_review" && (
                        <p className="mt-3 text-xs leading-6 text-slate">العرض الآن لدى فريق المراجعة. لا تحتاج إلى إعادة إرساله أو إنشاء نسخة بديلة أثناء المراجعة.</p>
                      )}
                      {offer.status === "published" && (
                        <Link href={`/offers/${offer.id}`} className="mt-3 inline-flex text-xs font-bold text-deep hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep">
                          فتح صفحة العرض المنشورة
                        </Link>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="incoming-requests-heading">
            <div className="mb-5">
              <h2 id="incoming-requests-heading" className="text-2xl font-bold text-inkwell">طلبات التواصل الواردة ({myLeads.length})</h2>
              <p className="mt-1 text-sm leading-7 text-slate">حدّث الحالة لتبقى لوحة التشغيل صادقة: جديد ← تم الاطلاع ← تم الرد ← مغلق.</p>
            </div>
            {myLeads.length === 0 ? (
              <div className="rounded-xl border border-dashed border-outlinev bg-cloud px-6 py-8 text-center text-sm leading-7 text-slate">لا طلبات بعد. ستظهر هنا فور وصول طلب حقيقي من أحد عروضك المنشورة.</div>
            ) : (
              <div className="space-y-4">
                {myLeads.map((lead) => {
                  const status = leadStatus(lead.status);
                  return (
                    <article key={lead.id} className="rounded-xl border border-outlinev bg-cloud p-4 md:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-inkwell">{lead.travelerName}</h3>
                          <p className="mt-1 font-mono text-[11px] text-slate">{timeAgo(lead.createdAt)} · {lead.travelerCount} مسافرين · {lead.travelDates ?? "تواريخ مفتوحة"}</p>
                        </div>
                        <span className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${status.cls}`}>{status.label}</span>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-[13px] leading-7 text-slate">{lead.message}</p>
                      <AgentLeadActions
                        requestId={lead.id}
                        initialStatus={lead.status}
                        travelerEmail={lead.travelerEmail}
                        travelerName={lead.travelerName}
                      />
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {account.role === "traveler" && (
        <section aria-labelledby="traveler-requests-heading">
          <h2 id="traveler-requests-heading" className="mb-5 text-2xl font-bold text-inkwell">طلباتي المرسلة ({myLeads.length})</h2>
          {myLeads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outlinev bg-cloud px-6 py-10 text-center">
              <p className="font-bold text-inkwell">لم ترسل طلب تواصل من هذا الحساب بعد.</p>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate">
                عندما تراسل وكيلاً وأنت مسجّل الدخول، يظهر الطلب هنا مع حالته. الطلبات القديمة المرسلة كضيف لا ننسبها لحسابك تلقائياً حفاظاً على الخصوصية.
              </p>
              <Link href="/offers" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-deep px-5 py-2.5 text-sm font-bold text-white hover:bg-horizon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep focus-visible:ring-offset-2">
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                تصفّح العروض المتاحة
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {myLeads.map((lead) => {
                const status = leadStatus(lead.status);
                return (
                  <article key={lead.id} className="rounded-xl border border-outlinev bg-cloud p-4 md:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <Link href={`/offers/${lead.offerId}`} className="font-bold text-deep hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep">طلب #{lead.id} — تفاصيل العرض</Link>
                      <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold ${status.cls}`}>
                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-slate">{timeAgo(lead.createdAt)} · {lead.travelDates ?? "تواريخ مفتوحة"}</p>
                    <p className="mt-3 whitespace-pre-wrap text-[13px] leading-7 text-slate">{lead.message}</p>
                    {lead.status === "responded" && (
                      <p className="mt-3 rounded-lg bg-verifiedbg px-3 py-2 text-xs font-semibold leading-6 text-verified">سجّل الوكيل أنه رد على الطلب. راجع البريد الإلكتروني الذي استخدمته عند الإرسال.</p>
                    )}
                    {lead.status === "closed" && (
                      <p className="mt-3 rounded-lg bg-low px-3 py-2 text-xs leading-6 text-slate">أُغلقت دورة هذا الطلب. يمكنك فتح تفاصيل العرض أو إرسال طلب جديد لعرض آخر عند الحاجة.</p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

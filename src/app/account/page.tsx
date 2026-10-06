import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contactRequests } from "@/db/schema";
import { pilotPasswordHash } from "@/lib/password-credentials";
import { accountEmailVerified } from "@/lib/password-recovery";
import { timeAgo } from "@/lib/format";
import { AgentDashboard } from "@/components/account/AgentDashboard";
import {
  secondaryAction,
  primaryAction,
} from "@/components/account/WorkspaceParts";
import { workspaceAccount } from "@/lib/agent-workspace-data";
import { CONTACT_STATUS_LABELS } from "@/lib/agent-workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "حسابي", robots: { index: false } };

export default async function AccountPage() {
  const account = await workspaceAccount();
  if (account.role === "agent") return <AgentDashboard />;
  const usesSilaPassword = pilotPasswordHash(account.passwordHash);
  const emailVerified = usesSilaPassword
    ? await accountEmailVerified(account.id, account.email)
    : true;
  const requests =
    account.role === "traveler"
      ? await db
          .select()
          .from(contactRequests)
          .where(eq(contactRequests.travelerAccountId, account.id))
          .orderBy(desc(contactRequests.createdAt), desc(contactRequests.id))
          .limit(20)
      : [];

  return (
    <div className="mx-auto max-w-5xl px-5 pb-12 pt-7 md:px-8 md:pt-9">
      <div className="mb-7">
        <p className="sila-eyebrow text-xs font-semibold text-signal">
          مساحتك داخل صلة
        </p>
        <h1 className="mt-2 break-words text-2xl font-bold text-deep md:text-3xl">
          مرحباً، <bdi>{account.displayName}</bdi>
        </h1>
        <p className="mt-2 break-all text-sm leading-7 text-slate">
          <bdi>{account.email}</bdi> ·{" "}
          {account.role === "admin" ? "إدارة" : "حساب مسافر"}
        </p>
        {usesSilaPassword && (
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
            <span className={emailVerified ? "text-verified" : "text-slate"}>
              {emailVerified ? "البريد موثّق" : "البريد غير موثّق"}
            </span>
            <Link
              href="/account/security"
              className="inline-flex min-h-11 items-center font-bold text-deep"
            >
              أمان الحساب وكلمة المرور
            </Link>
          </div>
        )}
        {account.role === "traveler" &&
          process.env.TRAVELER_WORKSPACE_ENABLED === "true" && (
            <div className="mt-4">
              <Link href="/account/travel" className={primaryAction}>
                افتح رحلاتي
              </Link>
              <p className="sila-reassurance mt-2">
                كل رحلة لها سياق واحد محفوظ، والخطوة التالية تظهر لك قبل التفاصيل الثانوية.
              </p>
            </div>
          )}
        {account.role === "admin" && (
          <Link href="/review" className={`${primaryAction} mt-4`}>
            بوابة فريق الثقة
          </Link>
        )}
      </div>
      {account.role === "traveler" && (
        <section className="sila-window overflow-hidden border border-outlinev bg-cloud">
          <h2 className="border-b border-outlinev px-5 py-5 text-xl font-bold text-deep">
            آخر طلباتي المرسلة
          </h2>
          {requests.length === 0 ? (
            <div className="p-6">
              <p className="font-bold text-deep">لم ترسل طلبات بعد.</p>
              <p className="mt-2 text-sm leading-7 text-slate">
                ابدأ بفحص جاهزية سفرك. تظهر هنا طلبات التواصل عندما ترسلها إلى
                وكيل موثّق.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {process.env.TRAVELER_WORKSPACE_ENABLED === "true" ? (
                  <Link href="/account/travel" className={primaryAction}>
                    ابدأ رحلة محفوظة
                  </Link>
                ) : (
                  <Link href="/readiness" className={primaryAction}>
                    افحص جاهزية سفرك
                  </Link>
                )}
                <Link href="/readiness" className={secondaryAction}>
                  فحص سريع بدون حفظ
                </Link>
              </div>
            </div>
          ) : (
            <>
              {requests.map((request) => (
                <article
                  key={request.id}
                  className="border-b border-outlinev p-5 last:border-b-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <Link
                      href={`/offers/${request.offerId}`}
                      className="text-sm font-bold text-deep hover:underline"
                    >
                      طلب #{request.id} — تفاصيل العرض
                    </Link>
                    <span className="rounded-lg bg-low px-3 py-1.5 text-xs font-semibold text-slate">
                      {CONTACT_STATUS_LABELS[request.status] ?? "غير متاح"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-slate">
                    {timeAgo(request.createdAt)} ·{" "}
                    {request.travelDates ?? "تواريخ مرنة"}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate">
                    {request.message}
                  </p>
                </article>
              ))}
              <p className="border-t border-outlinev px-5 py-4 text-xs leading-6 text-slate">
                تعرض هذه الصفحة آخر 20 طلبًا مرسلًا.
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}

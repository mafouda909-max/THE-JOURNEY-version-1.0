import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { accountFromCookies } from "@/lib/identity";
import { accountEmailVerified, recoveryMailReady } from "@/lib/password-recovery";
import { pilotPasswordHash } from "@/lib/password-credentials";
import { AccountSecurityPanel } from "@/components/AccountSecurityPanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "أمان الحساب",
  robots: { index: false },
};

export default async function AccountSecurityPage() {
  const account = await accountFromCookies();
  if (!account) redirect("/join");
  if (!["traveler", "agent"].includes(account.role)) redirect("/account");

  const [emailVerified, mailReady] = await Promise.all([
    accountEmailVerified(account.id, account.email), recoveryMailReady().catch(() => false),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-5 pb-24 pt-10 md:px-8">
      <Link href="/account" className="text-sm font-bold text-deep hover:underline">← العودة إلى حسابك</Link>
      <div className="mt-5">
        <div className="sila-eyebrow text-[11px] font-semibold text-signal">حسابك تحت سيطرتك</div>
        <h1 className="mt-2 text-3xl font-bold text-inkwell">أمان الحساب</h1>
        <p className="mt-2 text-sm leading-7 text-slate">تحقق من بريدك وأدر كلمة المرور والجلسات المرتبطة بحسابك.</p>
      </div>

      <div className="mt-7">
        {pilotPasswordHash(account.passwordHash) ? (
          <AccountSecurityPanel email={account.email} emailVerified={emailVerified} mailReady={mailReady} />
        ) : (
          <div className="sila-window border border-outlinev bg-cloud p-6 text-sm leading-7 text-slate">
            هذا الحساب يستخدم وسيلة دخول موثقة أخرى ولا توجد كلمة مرور صلة لتغييرها من هنا.
          </div>
        )}
      </div>
    </main>
  );
}

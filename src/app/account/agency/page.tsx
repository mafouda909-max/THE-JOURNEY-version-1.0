import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { accountFromCookies } from "@/lib/identity";
import { AgencyWorkspacePanel } from "./AgencyWorkspacePanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "مساحة الوكالة",
  robots: { index: false },
};

export default async function AgencyAccountPage() {
  const account = await accountFromCookies();
  if (!account) redirect("/join");

  return (
    <div className="mx-auto max-w-4xl px-5 pb-24 pt-10 md:px-8">
      <div className="mb-8">
        <Link href="/account" className="text-sm font-bold text-deep hover:underline">← العودة إلى الحساب</Link>
        <h1 className="mt-4 text-3xl font-bold text-inkwell">مساحة الوكالة</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate">
          طبقة تنظيمية للحسابات الأعضاء في الوكالة. صلاحيات الوصول تُحسم على الخادم من العضوية الفعلية، وليس من معرّف مساحة يرسله العميل.
        </p>
      </div>
      <AgencyWorkspacePanel canCreate={account.role === "agent"} />
    </div>
  );
}

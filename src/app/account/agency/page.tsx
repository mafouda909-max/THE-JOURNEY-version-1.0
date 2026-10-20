import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { accountFromCookies } from "@/lib/identity";
import { servicePilotWorkspaceIds } from "@/lib/service-fulfillment-domain";
import { AgencyWorkspacePanel } from "./AgencyWorkspacePanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "تشغيل الوكالة",
  robots: { index: false },
};

export default async function AgencyAccountPage() {
  const account = await accountFromCookies();
  if (!account) redirect("/join");

  return (
    <main className="mx-auto max-w-[1180px] px-5 pb-24 pt-9 md:px-8 md:pt-12">
      <header className="border-b border-outlinev pb-9">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="sila-eyebrow text-[11px] font-bold">Agency Operating Flow</div>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-[-0.04em] text-deep md:text-6xl">
              شغّل الطلب كمسار دليل، مش كـCRM.
            </h1>
            <p className="mt-5 max-w-[720px] text-[15px] leading-8 text-slate">
              كل طلب يدخل Inbox، يتحول لفرصة واحدة canonical، يرتبط بسياق سفر واضح،
              ثم Supplier evidence وQuote بصلاحية ومصدر قبل الإرسال للعميل.
            </p>
          </div>

          <Link href="/account" className="quiet-action">
            العودة
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-5">
          {[
            ["01", "Inbox"],
            ["02", "Opportunity"],
            ["03", "Supplier evidence"],
            ["04", "Quote"],
            ["05", "Delivery / Outcome"],
          ].map(([number, label]) => (
            <div key={number} className="border-t-2 border-outlinev pt-3">
              <div className="tnum text-[10px] font-bold text-signal">{number}</div>
              <div className="mt-1 text-[11px] font-bold text-deep">{label}</div>
            </div>
          ))}
        </div>
      </header>

      {servicePilotWorkspaceIds().length > 0 ? (
        <div className="mt-6">
          <Link href="/account/agency/services" className="quiet-action">
            تنفيذ خدمات المكتب
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      ) : null}

      <div className="mt-8">
        <AgencyWorkspacePanel canCreate={account.role === "agent"} />
      </div>
    </main>
  );
}

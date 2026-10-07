import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { pool } from "@/db";
import { accountFromCookies } from "@/lib/identity";
import { OpportunityWorkspace } from "./OpportunityWorkspace";
import { QuoteDeliveryPanel } from "./QuoteDeliveryPanel";
import { isServicePilotWorkspace } from "@/lib/service-fulfillment-domain";
import { ServiceFulfillmentPanel } from "@/components/services/ServiceFulfillmentPanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "مساحة الفرصة التجارية",
  robots: { index: false, follow: false },
};

type Params = { opportunityId: string };

function positiveId(value: string): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export default async function OpportunityPage({ params }: { params: Promise<Params> }) {
  const account = await accountFromCookies();
  if (!account) redirect("/join");

  const { opportunityId: rawOpportunityId } = await params;
  const opportunityId = positiveId(rawOpportunityId);
  if (!opportunityId) redirect("/account");

  const membership = await pool.query<{ workspace_id: number; role: "owner" | "member" }>(
    `SELECT m.workspace_id, m.role
       FROM agency_opportunities o
       JOIN agency_workspaces w ON w.id = o.workspace_id AND w.status = 'active'
       JOIN agency_memberships m
         ON m.workspace_id = o.workspace_id
        AND m.account_id = $1
        AND m.status = 'active'
      WHERE o.id = $2
      LIMIT 1`,
    [account.id, opportunityId],
  );

  const access = membership.rows[0];
  if (!access) redirect("/account");

  return (
    <main className="mx-auto max-w-[1240px] px-4 pb-24 pt-8 sm:px-6 md:px-8 md:pt-10">
      <header className="border-b border-outlinev pb-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="sila-eyebrow text-[11px] font-bold">Canonical Opportunity</div>
            <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-deep md:text-5xl">
              فرصة واحدة. مصدر واحد للحقيقة.
            </h1>
            <p className="mt-4 max-w-[720px] text-sm leading-7 text-slate">
              سياق العميل، Supplier evidence، نسخ الـQuote، المشاركة والنتيجة كلها مرتبطة بنفس Opportunity.
              لا تُرسل عرضًا قبل أن تكون نسخة السعر ومصدرها وصلاحيتها واضحة.
            </p>
          </div>

          <div className="text-left">
            <Link href="/account/agency" className="quiet-action">
              العودة للتشغيل
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="tnum mt-3 text-[10px] font-bold text-slate">Opportunity #{opportunityId}</div>
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-4">
          {[
            ["01", "Client intent"],
            ["02", "Supplier evidence"],
            ["03", "Quote version"],
            ["04", "Delivery / Outcome"],
          ].map(([number, label]) => (
            <div key={number} className="border-t-2 border-outlinev pt-3">
              <div className="tnum text-[10px] font-bold text-signal">{number}</div>
              <div className="mt-1 text-[11px] font-bold text-deep">{label}</div>
            </div>
          ))}
        </div>
      </header>

      <div className="mt-8">
        <OpportunityWorkspace
          workspaceId={access.workspace_id}
          opportunityId={opportunityId}
          membershipRole={access.role}
        />
      </div>

      <div className="mt-10 border-t border-outlinev pt-8">
        <QuoteDeliveryPanel workspaceId={access.workspace_id} opportunityId={opportunityId} />
      </div>

      {isServicePilotWorkspace(access.workspace_id) ? (
        <div className="mt-10 border-t border-outlinev pt-8">
          <ServiceFulfillmentPanel
            workspaceId={access.workspace_id}
            opportunityId={opportunityId}
            canManage={access.role === "owner"}
          />
        </div>
      ) : null}
    </main>
  );
}

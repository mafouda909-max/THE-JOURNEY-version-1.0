import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pool } from "@/db";
import { accountFromCookies } from "@/lib/identity";
import { OpportunityWorkspace } from "./OpportunityWorkspace";
import { QuoteDeliveryPanel } from "./QuoteDeliveryPanel";

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

  // Resolve access through the opportunity's own workspace instead of selecting an
  // arbitrary membership first. This stays correct if an employee belongs to more
  // than one agency workspace and fails closed for cross-workspace opportunity IDs.
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
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 md:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/account"
          className="rounded-lg border border-outlinev bg-white px-3 py-2 text-sm font-bold text-deep focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20"
        >
          العودة إلى الحساب
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate">Opportunity #{opportunityId}</span>
      </div>
      <QuoteDeliveryPanel workspaceId={access.workspace_id} opportunityId={opportunityId} />
      <OpportunityWorkspace workspaceId={access.workspace_id} opportunityId={opportunityId} membershipRole={access.role} />
    </div>
  );
}

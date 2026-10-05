import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { pool } from "@/db";
import { accountFromCookies } from "@/lib/identity";
import { serviceId, servicePilotWorkspaceIds } from "@/lib/service-fulfillment-domain";
import { ServiceOperationsDashboard } from "@/components/services/ServiceOperationsDashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تنفيذ خدمات المكتب", robots: { index: false, follow: false } };

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ workspaceId?: string | string[] }> }) {
  const account = await accountFromCookies();
  if (!account) redirect("/join");
  const raw = (await searchParams).workspaceId;
  const requested = raw === undefined ? undefined : serviceId(raw);
  if (requested === null) notFound();
  const ids = servicePilotWorkspaceIds();
  const memberships = ids.length ? await pool.query<{ id: number; name: string; role: "owner" | "member" }>(
    "SELECT w.id,w.name,m.role FROM agency_memberships m JOIN agency_workspaces w ON w.id=m.workspace_id AND w.status='active' WHERE m.account_id=$1 AND m.status='active' AND w.id=ANY($2::integer[]) ORDER BY w.id",
    [account.id, ids],
  ) : { rows: [] };
  const workspace = requested === undefined ? memberships.rows[0] : memberships.rows.find((item) => item.id === requested);
  if (requested !== undefined && !workspace) notFound();
  return <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 md:px-8" dir="rtl">
    <Link href="/account/agency" className="inline-flex min-h-11 items-center text-sm font-bold text-deep underline">العودة إلى مساحة المكتب</Link>
    <h1 className="mt-4 text-3xl font-bold text-inkwell">تنفيذ خدمات المكتب</h1>
    {workspace ? <>
      <nav aria-label="اختيار المكتب" className="my-5 flex flex-wrap gap-2">{memberships.rows.map((item) => <Link key={item.id} href={"/account/agency/services?workspaceId=" + item.id} aria-current={item.id === workspace.id ? "page" : undefined} className={item.id === workspace.id ? "min-h-11 max-w-full break-words rounded-xl bg-deep px-4 py-3 text-sm font-bold text-white" : "min-h-11 max-w-full break-words rounded-xl border border-outlinev bg-white px-4 py-3 text-sm font-bold text-deep"}>{item.name}</Link>)}</nav>
      <ServiceOperationsDashboard key={workspace.id} workspaceId={workspace.id} canManage={workspace.role === "owner"} />
    </> : <p className="mt-6 rounded-xl border border-outlinev bg-white p-5 text-sm leading-relaxed text-slate">تجربة تنفيذ الخدمات لم تُفعّل لمساحة مكتب مرتبطة بحسابك حتى الآن.</p>}
  </div>;
}

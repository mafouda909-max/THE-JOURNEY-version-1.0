import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { requireAdminMfa } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

/** ADMIN DASHBOARD — queue counters (verification + offers pending review). */
export default async function AdminDashboardPage() {
  const { supabase } = await requireAdminMfa();

  const [{ count: pendingOffers }, { count: inReviewAgents }, { count: verifiedAgents }] =
    await Promise.all([
      supabase.from("offers").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
      supabase
        .from("verification_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_review"),
      supabase.from("agent_profiles").select("id", { count: "exact", head: true }).eq("verification_status", "verified"),
    ]);

  return (
    <div>
      <h1 className="mb-6 text-headline-md text-on-surface">لوحة الإدارة</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/admin/agents">
          <Card hover className="p-6">
            <span className="block tabular-nums text-display-sm text-on-surface">{inReviewAgents ?? 0}</span>
            <span className="text-label-md text-on-surface-variant">طلبات توثيق قيد المراجعة</span>
          </Card>
        </Link>
        <Link href="/admin/offers">
          <Card hover className="p-6">
            <span className="block tabular-nums text-display-sm text-on-surface">{pendingOffers ?? 0}</span>
            <span className="text-label-md text-on-surface-variant">عروض تنتظر القرار</span>
          </Card>
        </Link>
        <Card className="p-6">
          <span className="block tabular-nums text-display-sm text-on-surface">{verifiedAgents ?? 0}</span>
          <span className="text-label-md text-on-surface-variant">وكلاء موثّقون</span>
        </Card>
      </div>
    </div>
  );
}

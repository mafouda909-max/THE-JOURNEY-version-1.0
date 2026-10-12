import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Card";
import { requireAgent } from "@/lib/auth/guards";
import { formatCount, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * AGENT DASHBOARD — SCREEN_MAP Zone4. States: First-time (unverified) |
 * Active (verified) | Suspended. Stats: own-offers aggregates only.
 */
export default async function DashboardPage() {
  const { supabase, agentProfileId } = await requireAgent();

  const { data: profile } = await supabase
    .from("agent_profiles")
    .select("display_name, verification_status, published_offers_count, avg_rating")
    .eq("id", agentProfileId)
    .single();

  const { count: liveOffers } = await supabase
    .from("offers")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentProfileId)
    .in("status", ["pending_review", "published"]);

  const verified = profile?.verification_status === "verified";
  const suspended = profile?.verification_status === "suspended";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-10">
      <h1 className="mb-1 text-headline-md text-on-surface">
        مرحبًا، {profile?.display_name ?? "وكيل"}
      </h1>
      <p className="mb-8 text-body-md text-on-surface-variant">
        لوحة تحكم الوكيل — عروضك وحالتك على منصة الرحلة.
      </p>

      {/* Verification status card */}
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={verified ? "success" : suspended ? "error" : "warning"}>
              {verified
                ? "وكيل موثّق"
                : suspended
                  ? "الحساب موقوف"
                  : profile?.verification_status === "in_review"
                    ? "توثيق قيد المراجعة"
                    : "غير موثّق بعد"}
            </Badge>
          </div>
          <p className="mt-2 text-body-sm text-on-surface-variant">
            {verified
              ? "يمكنك إنشاء العروض وإرسالها للمراجعة والنشر."
              : suspended
                ? "راسل الإدارة بخصوص إعادة تفعيل الحساب."
                : "أكمل خطوات التوثيق لتتمكن من نشر العروض."}
          </p>
        </div>
        {!verified && !suspended && (
          <Link
            href="/dashboard/verification"
            className="rounded-full bg-primary px-4 py-2 text-label-lg text-on-primary"
          >
            {profile?.verification_status === "in_review" ? "متابعة حالة التوثيق" : "إكمال التوثيق"}
          </Link>
        )}
      </Card>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <span className="block tabular-nums text-display-sm text-on-surface">
            {formatCount(liveOffers ?? 0)}
          </span>
          <span className="text-label-md text-on-surface-variant">عروض نشطة/قيد المراجعة</span>
        </Card>
        <Card className="p-5">
          <span className="block tabular-nums text-display-sm text-on-surface">
            {formatCount(profile?.published_offers_count ?? 0)}
          </span>
          <span className="text-label-md text-on-surface-variant">عروض منشورة</span>
        </Card>
        <Card className="p-5">
          <span className="block tabular-nums text-display-sm text-on-surface">
            {Number(profile?.avg_rating ?? 0).toFixed(1)}
          </span>
          <span className="text-label-md text-on-surface-variant">متوسط التقييم</span>
        </Card>
      </div>

      {/* Latest submitted offers quick view */}
      <section className="mt-10" aria-label="آخر العروض">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-title-lg text-on-surface">آخر عروضي</h2>
          <Link href="/dashboard/offers" className="text-label-lg text-primary hover:underline">
            إدارة كل العروض ←
          </Link>
        </div>
        <LatestOffers agentId={agentProfileId} />
      </section>
    </div>
  );
}

async function LatestOffers({ agentId }: { agentId: string }) {
  const { supabase } = await requireAgent();
  const { data: rows } = await supabase
    .from("offers")
    .select("id, title_ar, status, valid_until, price_amount, currency")
    .eq("agent_id", agentId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(4);

  if (!rows || rows.length === 0) {
    return (
      <Card className="p-6 text-center text-body-md text-on-surface-variant">
        لا توجد عروض بعد.{" "}
        <Link href="/dashboard/offers/new" className="text-primary hover:underline">
          أنشئ عرضك الأول
        </Link>
      </Card>
    );
  }

  const STATUS_AR: Record<string, string> = {
    draft: "مسودة",
    pending_review: "قيد المراجعة",
    published: "منشور",
    rejected: "مرفوض",
    expired: "منتهي",
    archived: "مؤرشف",
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((r) => (
        <Link key={r.id} href={`/dashboard/offers/${r.id}/edit`}>
          <Card hover className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-title-md text-on-surface">{r.title_ar}</span>
              <Badge tone={r.status === "published" ? "success" : r.status === "rejected" ? "error" : "neutral"}>
                {STATUS_AR[r.status] ?? r.status}
              </Badge>
            </div>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              صالح حتى {formatDate(r.valid_until)} · {Number(r.price_amount).toLocaleString("en-US")} {r.currency}
            </p>
          </Card>
        </Link>
      ))}
    </div>
  );
}

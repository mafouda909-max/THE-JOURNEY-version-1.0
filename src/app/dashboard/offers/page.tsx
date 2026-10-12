import Link from "next/link";
import { Card, Badge } from "@/components/ui/Card";
import { requireAgent } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_AR: Record<string, string> = {
  draft: "مسودة",
  pending_review: "قيد المراجعة",
  published: "منشور",
  rejected: "مرفوض",
  expired: "منتهي",
  archived: "مؤرشف",
};

function tone(s: string): "success" | "error" | "warning" | "neutral" {
  return s === "published"
    ? "success"
    : s === "rejected"
      ? "error"
      : s === "pending_review"
        ? "warning"
        : "neutral";
}

/** OFFER MANAGEMENT — own offers across all states. */
export default async function MyOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;
  const { supabase, agentProfileId } = await requireAgent();

  const { data: rows } = await supabase
    .from("offers")
    .select("id, title_ar, status, price_amount, currency, valid_until, updated_at")
    .eq("agent_id", agentProfileId)
    .order("updated_at", { ascending: false });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-headline-md text-on-surface">إدارة العروض</h1>
        <Link
          href="/dashboard/offers/new"
          className="rounded-full bg-primary px-4 py-2 text-label-lg text-on-primary"
        >
          + عرض جديد
        </Link>
      </div>

      {s && (
        <p role="status" className="mb-4 rounded-md bg-primary-container px-3 py-2 text-body-sm text-on-primary-container">
          {s === "submitted"
            ? "تم إرسال العرض إلى المراجعة."
            : s === "archived"
              ? "تم أرشفة العرض."
              : s === "resubmitted"
                ? "تم إعادة إرسال العرض للمراجعة."
                : s === "major_submitted"
                  ? "تم إرسال التعديل الجوهري إلى المراجعة."
                  : "تم الحفظ."}
        </p>
      )}

      {!rows || rows.length === 0 ? (
        <Card className="p-10 text-center text-body-md text-on-surface-variant">
          لا توجد عروض بعد.{" "}
          <Link href="/dashboard/offers/new" className="text-primary hover:underline">
            أنشئ عرضك الأول
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Link key={r.id} href={`/dashboard/offers/${r.id}/edit`}>
              <Card hover className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <span className="block truncate text-title-md text-on-surface">{r.title_ar}</span>
                  <span className="text-label-md text-on-surface-variant">
                    آخر تحديث {formatDate(r.updated_at)} · صالح حتى {formatDate(r.valid_until)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums text-body-md font-semibold text-primary">
                    {Number(r.price_amount).toLocaleString("en-US")} {r.currency}
                  </span>
                  <Badge tone={tone(r.status)}>{STATUS_AR[r.status] ?? r.status}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
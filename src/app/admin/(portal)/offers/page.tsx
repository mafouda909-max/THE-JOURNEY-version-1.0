import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { requireAdminMfa } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** OFFER REVIEW QUEUE — pending_review offers awaiting T2/T3 decisions. */
export default async function AdminOffersQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; s?: string }>;
}) {
  const { e, s } = await searchParams;
  const { supabase } = await requireAdminMfa();

  const { data: rows } = await supabase
    .from("offers")
    .select("id, title_ar, submitted_at, price_amount, currency, trip_type, agent_profiles(display_name)")
    .eq("status", "pending_review")
    .order("submitted_at", { ascending: true });

  return (
    <div>
      <h1 className="mb-1 text-headline-md text-on-surface">مراجعة العروض</h1>
      <p className="mb-6 text-body-sm text-on-surface-variant">
        عروض قيد المراجعة ({rows?.length ?? 0}).
      </p>

      {e && <p role="alert" className="mb-4 rounded-md bg-error-container px-3 py-2 text-body-sm">{e}</p>}
      {s && (
        <p role="status" className="mb-4 rounded-md bg-primary-container px-3 py-2 text-body-sm">
          {s === "approved" ? "تم اعتماد العرض ونشره." : "تم رفض العرض وإشعار الوكيل."}
        </p>
      )}

      {!rows || rows.length === 0 ? (
        <Card className="p-8 text-center text-body-md text-on-surface-variant">
          لا توجد عروض تنتظر القرار.
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const agent = r.agent_profiles as unknown as { display_name: string } | null;
            return (
              <Link key={r.id} href={`/admin/offers/${r.id}`}>
                <Card hover className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <span className="block truncate text-title-md text-on-surface">{r.title_ar}</span>
                    <span className="text-label-md text-on-surface-variant">
                      {agent?.display_name ?? "—"} · أُرسل {formatDate(r.submitted_at)} · {r.trip_type}
                    </span>
                  </div>
                  <span className="tabular-nums font-semibold text-primary">
                    {Number(r.price_amount).toLocaleString("en-US")} {r.currency}
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

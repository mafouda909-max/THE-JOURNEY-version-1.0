import Link from "next/link";
import { Badge, Card } from "@/components/ui/Card";
import { requireAdminMfa } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format";
import { decideVerificationAction, suspendAgentAction } from "@/lib/admin/actions";

export const dynamic = "force-dynamic";

/** ADMIN AGENT MANAGEMENT — verification queue + decisions + suspension. */
export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; s?: string }>;
}) {
  const { e, s } = await searchParams;
  const { supabase } = await requireAdminMfa();

  const { data: queue } = await supabase
    .from("verification_requests")
    .select("id, status, submitted_at, reviewed_at, agent_id, agent_profiles(display_name, business_name)")
    .order("submitted_at", { ascending: false })
    .limit(50);

  const inReview = (queue ?? []).filter((r) => r.status === "in_review");
  const others = (queue ?? []).filter((r) => r.status !== "in_review");

  return (
    <div>
      <h1 className="mb-1 text-headline-md text-on-surface">الوكلاء والتوثيق</h1>
      <p className="mb-6 text-body-sm text-on-surface-variant">
        مراجعة طلبات التوثيق — SLA ٤٨ ساعة. الرفض يتطلب سببًا.
      </p>

      {e && <p role="alert" className="mb-4 rounded-md bg-error-container px-3 py-2 text-body-sm">{e}</p>}
      {s && <p role="status" className="mb-4 rounded-md bg-primary-container px-3 py-2 text-body-sm">تم تسجيل القرار.</p>}

      <h2 className="mb-3 text-title-lg text-on-surface">قيد المراجعة ({inReview.length})</h2>
      {inReview.length === 0 ? (
        <Card className="mb-8 p-5 text-body-sm text-on-surface-variant">لا طلبات معلقة.</Card>
      ) : (
        <div className="mb-8 space-y-4">
          {inReview.map((r) => {
            const profile = r.agent_profiles as unknown as { display_name: string; business_name: string | null };
            return (
              <Card key={r.id} className="p-5" data-testid={`vreq-${r.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-title-md text-on-surface">{profile?.display_name}</span>
                    {profile?.business_name && (
                      <span className="ms-2 text-body-sm text-on-surface-variant">{profile.business_name}</span>
                    )}
                  </div>
                  <span className="text-label-md text-on-surface-variant">
                    أُرسل {formatDate(r.submitted_at)}
                  </span>
                </div>

                {/* Decision form */}
                <form action={decideVerificationAction} className="mt-4 space-y-2">
                  <input type="hidden" name="request_id" value={r.id} />
                  <input
                    name="note"
                    placeholder="ملاحظة القرار (إلزامية عند الرفض)"
                    className="h-11 w-full rounded-md border border-outline-variant bg-surface px-3 text-body-md"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      name="approved"
                      value="true"
                      className="rounded-full bg-primary px-4 py-2 text-label-lg text-on-primary"
                    >
                      اعتماد التوثيق
                    </button>
                    <button
                      type="submit"
                      name="approved"
                      value="false"
                      className="rounded-full border border-error px-4 py-2 text-label-lg text-error"
                    >
                      رفض الطلب
                    </button>
                  </div>
                </form>
              </Card>
            );
          })}
        </div>
      )}

      <h2 className="mb-3 text-title-lg text-on-surface">قرارات سابقة</h2>
      <div className="space-y-2">
        {(others ?? []).slice(0, 10).map((r) => {
          const profile = r.agent_profiles as unknown as { display_name: string };
          return (
            <Card key={r.id} className="flex items-center justify-between p-3">
              <Link href={`/admin/agents/${r.agent_id}`} className="text-body-sm text-primary hover:underline">
                {profile?.display_name ?? "وكيل"}
              </Link>
              <Badge tone={r.status === "approved" ? "success" : "error"}>{r.status}</Badge>
              <span className="text-label-md text-on-surface-variant">{formatDate(r.reviewed_at)}</span>
            </Card>
          );
        })}
        {(others?.length ?? 0) === 0 && (
          <p className="text-body-sm text-on-surface-variant">لا سجل بعد.</p>
        )}
      </div>

      <details className="mt-10 rounded-lg border border-outline-variant p-4">
        <summary className="cursor-pointer text-title-md text-on-surface">إيقاف/إعادة تفعيل وكيل</summary>
        <form action={suspendAgentAction} className="mt-3 space-y-3">
          <input name="agent_id" placeholder="معرّف ملف الوكيل (uuid)" required
            className="h-11 w-full rounded-md border border-outline-variant bg-surface px-3 font-mono text-body-sm" />
          <input name="reason" placeholder="السبب"
            className="h-11 w-full rounded-md border border-outline-variant bg-surface px-3 text-body-md" />
          <div className="flex gap-2">
            <button type="submit" name="suspended" value="true"
              className="rounded-full border border-error px-4 py-2 text-label-lg text-error">
              إيقاف
            </button>
            <button type="submit" name="suspended" value="false"
              className="rounded-full border border-outline-variant px-4 py-2 text-label-lg text-on-surface">
              إعادة تفعيل
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}

import { Badge, Card } from "@/components/ui/Card";
import { requireAgent } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format";
import { VerificationFlow } from "./flow";

export const dynamic = "force-dynamic";

const STATUS_AR: Record<string, string> = {
  unverified: "غير موثّق بعد",
  in_review: "قيد المراجعة",
  verified: "موثّق",
  rejected: "مرفوض",
  suspended: "موقوف",
};

/** VERIFICATION STATUS + document submission (§4.3). */
export default async function VerificationPage() {
  const { supabase, agentProfileId } = await requireAgent();

  const { data: profile } = await supabase
    .from("agent_profiles")
    .select("verification_status, verified_at")
    .eq("id", agentProfileId)
    .single();

  const { data: requests } = await supabase
    .from("verification_requests")
    .select("id, status, submitted_at, reviewed_at, decision_note")
    .eq("agent_id", agentProfileId)
    .order("submitted_at", { ascending: false })
    .limit(5);

  const active = profile?.verification_status;
  const canSubmit =
    active === "unverified" ||
    active === "rejected" ||
    (active === null && !requests?.some((r) => r.status === "in_review"));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-6">
      <h1 className="mb-1 text-headline-md text-on-surface">توثيق الحساب</h1>
      <div className="mb-6 flex items-center gap-2">
        <Badge
          tone={
            profile?.verification_status === "verified"
              ? "success"
              : profile?.verification_status === "suspended" || profile?.verification_status === "rejected"
                ? "error"
                : "warning"
          }
        >
          {STATUS_AR[profile?.verification_status ?? "unverified"] ?? "غير موثّق"}
        </Badge>
        {profile?.verified_at && (
          <span className="text-label-md text-on-surface-variant">
            منذ {formatDate(profile.verified_at)}
          </span>
        )}
      </div>

      <VerificationFlow agentId={agentProfileId} disabled={!canSubmit} />

      <section className="mt-8" aria-label="سجل الطلبات">
        <h2 className="mb-3 text-title-lg text-on-surface">سجل الطلبات</h2>
        {!requests || requests.length === 0 ? (
          <Card className="p-5 text-body-sm text-on-surface-variant">لا توجد طلبات سابقة.</Card>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-label-md text-on-surface-variant">
                    أُرسل {formatDate(r.submitted_at)}
                    {r.reviewed_at ? ` · قُرر ${formatDate(r.reviewed_at)}` : ""}
                  </span>
                  <Badge tone={r.status === "approved" ? "success" : r.status === "rejected" ? "error" : "neutral"}>
                    {STATUS_AR[r.status] ?? r.status}
                  </Badge>
                </div>
                {r.decision_note && (
                  <p className="mt-2 text-body-sm text-on-surface-variant">{r.decision_note}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

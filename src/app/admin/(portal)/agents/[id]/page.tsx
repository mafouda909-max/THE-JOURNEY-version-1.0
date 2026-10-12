import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge, Card } from "@/components/ui/Card";
import { requireAdminMfa } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** AGENT VERIFICATION DETAIL — request history for one agent. */
export default async function AdminAgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdminMfa();

  const { data: agentRow } = await supabase
    .from("agent_profiles")
    .select("display_name, business_name, verification_status, verified_at, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!agentRow) notFound();
  const agent = agentRow;

  const { data: requests } = await supabase
    .from("verification_requests")
    .select("id, status, submitted_at, reviewed_at, decision_note")
    .eq("agent_id", id)
    .order("submitted_at", { ascending: false });

  return (
    <div>
      <nav aria-label="مسار التنقل" className="mb-4 text-label-lg text-on-surface-variant">
        <Link href="/admin/agents" className="hover:underline">الوكلاء والتوثيق</Link>
      </nav>
      <h1 className="mb-1 text-headline-md text-on-surface">{agent.display_name}</h1>
      <p className="mb-6 text-body-sm text-on-surface-variant">{agent.business_name ?? "—"}</p>

      <Card className="p-5">
        <Badge tone={agent.verification_status === "verified" ? "success" : "warning"}>
          {agent.verification_status}
        </Badge>
        {agent.verified_at && (
          <span className="ms-2 text-label-md text-on-surface-variant">
            وُثّق في {formatDate(agent.verified_at)}
          </span>
        )}
        <Link href="/admin/agents" className="mt-3 block text-label-lg text-primary hover:underline">
          اتخاذ قرار توثيق ←
        </Link>
      </Card>

      <h2 className="mb-3 mt-8 text-title-lg text-on-surface">طلبات التوثيق</h2>
      <div className="space-y-2">
        {(requests ?? []).map((r) => (
          <Card key={r.id} className="flex items-center justify-between p-3 text-body-sm">
            <span>{formatDate(r.submitted_at)}</span>
            <Badge tone={r.status === "approved" ? "success" : r.status === "rejected" ? "error" : "neutral"}>
              {r.status}
            </Badge>
            {r.decision_note && (
              <span className="truncate text-on-surface-variant">{r.decision_note}</span>
            )}
          </Card>
        ))}
        {(requests?.length ?? 0) === 0 && (
          <p className="text-body-sm text-on-surface-variant">لا طلبات.</p>
        )}
      </div>
    </div>
  );
}

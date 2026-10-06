import type { Metadata } from "next";
import {
  EmptyWork,
  MissingAgent,
  RequestRow,
  WorkspaceIntro,
  WorkspacePagination,
} from "@/components/account/WorkspaceParts";
import {
  agentWorkspaceCounts,
  ownedAgent,
  ownedRequests,
  WORKSPACE_PAGE_SIZE,
  workspaceAccount,
  workspacePage,
} from "@/lib/agent-workspace-data";

export const metadata: Metadata = {
  title: "طلبات التواصل",
  robots: { index: false },
};
export default async function AgentRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const [agent, account, params] = await Promise.all([
    ownedAgent(),
    workspaceAccount(),
    searchParams,
  ]);
  if (!agent) return <MissingAgent />;
  const counts = await agentWorkspaceCounts(agent.id, account.id);
  const page = Math.min(
    workspacePage(params.page),
    Math.max(1, Math.ceil(counts.requests / WORKSPACE_PAGE_SIZE)),
  );
  const requests = await ownedRequests(
    agent.id,
    WORKSPACE_PAGE_SIZE,
    (page - 1) * WORKSPACE_PAGE_SIZE,
  );
  return (
    <div className="mx-auto max-w-6xl px-5 pb-12 pt-7 md:px-8 md:pt-9">
      <WorkspaceIntro
        title="طلبات التواصل"
        note="اقرأ طلب المسافر، تواصل معه، ثم سجّل المتابعة الفعلية. تغيير الحالة لا يرسل رسالة بالنيابة عنك."
      />
      <section className="overflow-hidden border-y border-outlinev bg-cloud">
        <div className="flex items-center justify-between gap-4 border-b border-outlinev bg-low/35 px-5 py-4 md:px-6">
          <h2 className="text-base font-bold text-deep">
            كل الطلبات ({counts.requests})
          </h2>
        </div>
        {requests.length ? (
          requests.map((request) => (
            <RequestRow key={request.id} request={request} actionable />
          ))
        ) : (
          <EmptyWork kind="requests" />
        )}
      </section>
      <WorkspacePagination
        page={page}
        total={counts.requests}
        pageSize={WORKSPACE_PAGE_SIZE}
        href="/account/requests"
      />
    </div>
  );
}

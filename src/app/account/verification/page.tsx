import type { Metadata } from "next";
import {
  ownedAgent,
  ownedVerificationSnapshot,
} from "@/lib/agent-workspace-data";
import {
  MissingAgent,
  WorkspaceIntro,
} from "@/components/account/WorkspaceParts";
import { AgentVerificationPanel } from "@/components/account/AgentVerificationPanel";

export const metadata: Metadata = {
  title: "توثيق الوكيل",
  robots: { index: false },
};
export default async function AgentVerificationPage() {
  const agent = await ownedAgent();
  if (!agent) return <MissingAgent />;
  const snapshot = await ownedVerificationSnapshot(agent.id);
  return (
    <div className="mx-auto max-w-5xl px-5 pb-12 pt-7 md:px-8 md:pt-9">
      <WorkspaceIntro
        title="توثيق الوكيل"
        note="خطوة تختارها عندما تكون جاهزًا للظهور للمسافرين وإرسال عروضك. حسابك متاح بدون رفع مستندات."
      />
      <AgentVerificationPanel
        initialProfile={agent}
        initialDocuments={snapshot.documents}
        observedAt={snapshot.observedAt}
      />
    </div>
  );
}

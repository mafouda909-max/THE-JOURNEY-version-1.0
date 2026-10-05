import type { Metadata } from "next";
import { AgentProfileEditor } from "@/components/account/AgentProfileEditor";
import {
  MissingAgent,
  WorkspaceIntro,
} from "@/components/account/WorkspaceParts";
import { ownedAgent } from "@/lib/agent-workspace-data";

export const metadata: Metadata = {
  title: "الملف المهني",
  robots: { index: false },
};
export default async function AgentProfilePage() {
  const agent = await ownedAgent();
  if (!agent) return <MissingAgent />;
  const editable = {
    ...agent,
    city: agent.city === "—" ? "" : agent.city,
    country: agent.country === "—" ? "" : agent.country,
  };
  return (
    <div className="mx-auto max-w-6xl px-5 pb-12 pt-7 md:px-8 md:pt-9">
      <WorkspaceIntro
        title="الملف المهني"
        note="جهّز تعريفًا واضحًا بك وبخدماتك. توثيق المستندات خطوة مستقلة تبدأها عندما تكون جاهزًا."
      />
      <AgentProfileEditor initialProfile={editable} />
    </div>
  );
}

import type { ReactNode } from "react";
import { ownedAgent, workspaceAccount } from "@/lib/agent-workspace-data";
import { WorkspaceShell } from "@/components/account/WorkspaceShell";

export const dynamic = "force-dynamic";

export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const account = await workspaceAccount();
  const agent = account.role === "agent" ? await ownedAgent() : null;
  return (
    <WorkspaceShell
      role={account.role}
      displayName={agent?.displayName ?? account.displayName}
      travelerWorkspace={process.env.TRAVELER_WORKSPACE_ENABLED === "true"}
    >
      {children}
    </WorkspaceShell>
  );
}

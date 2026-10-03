import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  agencyMemberships,
  agencyWorkspaces,
  type AgencyMembership,
  type AgencyWorkspace,
} from "@/db/agency-schema";
import { accountFromRequest, requireAccount } from "@/lib/identity";
import type { Account } from "@/db/schema";
import type { AgencyMembershipRole } from "@/lib/agency-policy";

export type AgencyWorkspaceAccess = {
  denied: NextResponse | null;
  account: Account | null;
  workspace: AgencyWorkspace | null;
  membership: AgencyMembership | null;
};

export async function getAgencyWorkspaceAccess(
  request: Request,
  workspaceId: number,
  allowedRoles?: readonly AgencyMembershipRole[],
): Promise<AgencyWorkspaceAccess> {
  const account = await accountFromRequest(request);
  const denied = requireAccount(account);
  if (denied || !account) return { denied, account: null, workspace: null, membership: null };

  const rows = await db
    .select({ workspace: agencyWorkspaces, membership: agencyMemberships })
    .from(agencyMemberships)
    .innerJoin(agencyWorkspaces, eq(agencyMemberships.workspaceId, agencyWorkspaces.id))
    .where(and(
      eq(agencyWorkspaces.id, workspaceId),
      eq(agencyWorkspaces.status, "active"),
      eq(agencyMemberships.accountId, account.id),
      eq(agencyMemberships.status, "active"),
    ))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return {
      denied: NextResponse.json({ error: "Agency workspace not found for this account." }, { status: 404 }),
      account,
      workspace: null,
      membership: null,
    };
  }

  if (allowedRoles && !allowedRoles.includes(row.membership.role as AgencyMembershipRole)) {
    return {
      denied: NextResponse.json({ error: "Forbidden — workspace owner access required." }, { status: 403 }),
      account,
      workspace: row.workspace,
      membership: row.membership,
    };
  }

  return { denied: null, account, workspace: row.workspace, membership: row.membership };
}

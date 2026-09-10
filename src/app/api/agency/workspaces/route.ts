import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { agencyDomainEvents, agencyMemberships, agencyWorkspaces } from "@/db/agency-schema";
import { accountFromRequest, requireAccount } from "@/lib/identity";
import { parseWorkspaceCreateInput, sanitizeAgencyEventPayload } from "@/lib/agency-policy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const account = await accountFromRequest(request);
  const denied = requireAccount(account);
  if (denied) return denied;
  if (!account) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const rows = await db
    .select({ workspace: agencyWorkspaces, membership: agencyMemberships })
    .from(agencyMemberships)
    .innerJoin(agencyWorkspaces, eq(agencyMemberships.workspaceId, agencyWorkspaces.id))
    .where(and(
      eq(agencyMemberships.accountId, account.id),
      eq(agencyMemberships.status, "active"),
      eq(agencyWorkspaces.status, "active"),
    ))
    .orderBy(asc(agencyWorkspaces.createdAt));

  return NextResponse.json({
    workspaces: rows.map(({ workspace, membership }) => ({
      id: workspace.id,
      name: workspace.name,
      status: workspace.status,
      createdAt: workspace.createdAt,
      membership: { id: membership.id, role: membership.role, status: membership.status },
    })),
  });
}

export async function POST(request: Request) {
  const account = await accountFromRequest(request);
  const denied = requireAccount(account, ["agent"]);
  if (denied) return denied;
  if (!account) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!account.agentId) {
    return NextResponse.json({ error: "Agent account is not linked to an agent profile." }, { status: 409 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = parseWorkspaceCreateInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 422 });

  const outcome = await db.transaction(async (tx) => {
    const agentRows = await tx
      .select({ id: agents.id, displayName: agents.displayName })
      .from(agents)
      .where(and(
        eq(agents.id, account.agentId!),
        eq(agents.licenseType, "agency"),
        eq(agents.verificationStatus, "verified"),
      ))
      .limit(1);
    const agent = agentRows[0];
    if (!agent) return { kind: "not_eligible" } as const;

    const [workspace] = await tx
      .insert(agencyWorkspaces)
      .values({ agentId: agent.id, name: agent.displayName, status: "active" })
      .onConflictDoNothing({ target: agencyWorkspaces.agentId })
      .returning();
    if (!workspace) return { kind: "exists" } as const;

    const [membership] = await tx
      .insert(agencyMemberships)
      .values({ workspaceId: workspace.id, accountId: account.id, role: "owner", status: "active" })
      .returning();

    await tx.insert(agencyDomainEvents).values({
      workspaceId: workspace.id,
      actorAccountId: account.id,
      eventType: "workspace.created",
      payload: sanitizeAgencyEventPayload({ membershipId: membership.id, role: "owner" }),
      referenceType: "workspace",
      referenceId: workspace.id,
      correlationId: randomUUID(),
    });

    return { kind: "created", workspace, membership } as const;
  });

  if (outcome.kind === "not_eligible") {
    return NextResponse.json(
      { error: "Agency workspace creation requires a verified agency agent profile." },
      { status: 403 },
    );
  }
  if (outcome.kind === "exists") {
    return NextResponse.json({ error: "This agency already has a workspace." }, { status: 409 });
  }

  return NextResponse.json({
    workspace: {
      id: outcome.workspace.id,
      name: outcome.workspace.name,
      status: outcome.workspace.status,
      createdAt: outcome.workspace.createdAt,
    },
    membership: {
      id: outcome.membership.id,
      role: outcome.membership.role,
      status: outcome.membership.status,
    },
  }, { status: 201 });
}

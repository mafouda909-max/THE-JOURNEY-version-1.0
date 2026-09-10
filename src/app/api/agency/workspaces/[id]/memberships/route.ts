import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { agencyDomainEvents, agencyMemberships, agencyWorkspaces } from "@/db/agency-schema";
import { getAgencyWorkspaceAccess } from "@/lib/agency-access";
import { accountFromRequest, requireAccount } from "@/lib/identity";
import { parseMembershipCreateInput, positiveAgencyId, sanitizeAgencyEventPayload } from "@/lib/agency-policy";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const workspaceId = positiveAgencyId(id);
  if (!workspaceId) return NextResponse.json({ error: "Invalid workspace id." }, { status: 400 });

  const access = await getAgencyWorkspaceAccess(request, workspaceId, ["owner"]);
  if (access.denied) return access.denied;

  const memberships = await db
    .select({
      id: agencyMemberships.id,
      accountId: agencyMemberships.accountId,
      role: agencyMemberships.role,
      status: agencyMemberships.status,
      createdAt: agencyMemberships.createdAt,
    })
    .from(agencyMemberships)
    .where(eq(agencyMemberships.workspaceId, workspaceId))
    .orderBy(asc(agencyMemberships.createdAt));

  return NextResponse.json({ workspaceId, memberships });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const workspaceId = positiveAgencyId(id);
  if (!workspaceId) return NextResponse.json({ error: "Invalid workspace id." }, { status: 400 });

  const account = await accountFromRequest(request);
  const denied = requireAccount(account);
  if (denied || !account) return denied;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = parseMembershipCreateInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 422 });

  const outcome = await db.transaction(async (tx) => {
    const accessRows = await tx
      .select({ membership: agencyMemberships, workspace: agencyWorkspaces })
      .from(agencyMemberships)
      .innerJoin(agencyWorkspaces, eq(agencyMemberships.workspaceId, agencyWorkspaces.id))
      .where(and(
        eq(agencyWorkspaces.id, workspaceId),
        eq(agencyWorkspaces.status, "active"),
        eq(agencyMemberships.accountId, account.id),
        eq(agencyMemberships.status, "active"),
      ))
      .limit(1);
    const current = accessRows[0];
    if (!current) return { kind: "not_member" } as const;
    if (current.membership.role !== "owner") return { kind: "forbidden" } as const;

    const targetRows = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.id, parsed.value.accountId))
      .limit(1);
    if (!targetRows[0]) return { kind: "target_missing" } as const;

    const [membership] = await tx
      .insert(agencyMemberships)
      .values({
        workspaceId,
        accountId: parsed.value.accountId,
        role: parsed.value.role,
        status: "active",
      })
      .onConflictDoNothing({ target: [agencyMemberships.workspaceId, agencyMemberships.accountId] })
      .returning();
    if (!membership) return { kind: "duplicate" } as const;

    await tx.insert(agencyDomainEvents).values({
      workspaceId,
      actorAccountId: account.id,
      eventType: "membership.added",
      payload: sanitizeAgencyEventPayload({
        membershipId: membership.id,
        accountId: membership.accountId,
        role: membership.role,
      }),
      referenceType: "membership",
      referenceId: membership.id,
      correlationId: randomUUID(),
    });

    return { kind: "created", membership } as const;
  });

  if (outcome.kind === "not_member") {
    return NextResponse.json({ error: "Agency workspace not found for this account." }, { status: 404 });
  }
  if (outcome.kind === "forbidden") {
    return NextResponse.json({ error: "Forbidden — workspace owner access required." }, { status: 403 });
  }
  if (outcome.kind === "target_missing") {
    return NextResponse.json({ error: "Target account not found." }, { status: 404 });
  }
  if (outcome.kind === "duplicate") {
    return NextResponse.json({ error: "Account is already a workspace member." }, { status: 409 });
  }

  return NextResponse.json({
    membership: {
      id: outcome.membership.id,
      accountId: outcome.membership.accountId,
      role: outcome.membership.role,
      status: outcome.membership.status,
      createdAt: outcome.membership.createdAt,
    },
  }, { status: 201 });
}

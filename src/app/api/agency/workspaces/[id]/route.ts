import { NextResponse } from "next/server";
import { getAgencyWorkspaceAccess } from "@/lib/agency-access";
import { positiveAgencyId } from "@/lib/agency-policy";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const workspaceId = positiveAgencyId(id);
  if (!workspaceId) return NextResponse.json({ error: "Invalid workspace id." }, { status: 400 });

  const access = await getAgencyWorkspaceAccess(request, workspaceId);
  if (access.denied) return access.denied;
  const workspace = access.workspace!;
  const membership = access.membership!;

  return NextResponse.json({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      status: workspace.status,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    },
    membership: {
      id: membership.id,
      role: membership.role,
      status: membership.status,
    },
  });
}

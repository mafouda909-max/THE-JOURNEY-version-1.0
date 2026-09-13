import { NextResponse } from "next/server";
import { getAgencyWorkspaceAccess } from "@/lib/agency-access";
import { executeCommercialCommand, listCommercialPipeline } from "@/lib/commercial-service";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
type Json = Record<string, unknown>;

function positiveId(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isSafeInteger(parsed) && Number(parsed) > 0 ? Number(parsed) : null;
}

async function parseBody(request: Request): Promise<Json | null> {
  try {
    const value: unknown = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Json : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  const workspaceId = positiveId(id);
  if (!workspaceId) return NextResponse.json({ error: "Invalid workspace id." }, { status: 400 });

  const access = await getAgencyWorkspaceAccess(request, workspaceId);
  if (access.denied) return access.denied;

  const opportunities = await listCommercialPipeline(workspaceId);
  return NextResponse.json({
    workspace: { id: workspaceId, role: access.membership?.role },
    opportunities,
  });
}

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const workspaceId = positiveId(id);
  if (!workspaceId) return NextResponse.json({ error: "Invalid workspace id." }, { status: 400 });

  const access = await getAgencyWorkspaceAccess(request, workspaceId);
  if (access.denied) return access.denied;
  if (!access.account || !access.workspace || !access.membership) {
    return NextResponse.json({ error: "Agency access unavailable." }, { status: 403 });
  }

  const body = await parseBody(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  // `channel=link` must represent a real secure delivery, not an internal button
  // click. The quote-deliveries boundary separates link preparation from actual
  // send activation and is the only source of link-based quote_sent telemetry.
  if (body.command === "send_quote" && body.channel === "link") {
    return NextResponse.json(
      { error: "استخدم مشاركة العرض الآمنة داخل مساحة الفرصة لإنشاء رابط العميل ثم تأكيد إرساله." },
      { status: 409, headers: { "cache-control": "no-store" } },
    );
  }

  const result = await executeCommercialCommand({
    workspaceId,
    agentId: access.workspace.agentId,
    accountId: access.account.id,
    membershipRole: access.membership.role as "owner" | "member",
  }, body);
  return NextResponse.json(result.body, { status: result.status });
}

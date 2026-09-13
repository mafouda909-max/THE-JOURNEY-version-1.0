import { NextResponse } from "next/server";
import { getAgencyWorkspaceAccess } from "@/lib/agency-access";
import { activateQuoteDelivery, prepareQuoteDelivery } from "@/lib/quote-delivery-agent";

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

  const actor = { workspaceId, accountId: access.account.id };
  const result = body.action === "activate"
    ? await activateQuoteDelivery(actor, { token: body.token })
    : body.action === "prepare"
      ? await prepareQuoteDelivery(actor, { quoteId: body.quoteId, quoteVersionId: body.quoteVersionId, channel: body.channel })
      : { status: 422, body: { error: "Quote delivery action must be prepare or activate." } };

  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "cache-control": "no-store" },
  });
}

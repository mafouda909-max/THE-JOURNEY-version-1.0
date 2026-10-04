import { NextResponse } from "next/server";
import { accountFromRequest, requireAccount } from "@/lib/identity";
import { manageServiceStatusLink } from "@/lib/service-fulfillment";
import { serviceId } from "@/lib/service-fulfillment-domain";
import { readServiceBody } from "@/lib/service-request";

export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string; orderId: string }> }) {
  const account = await accountFromRequest(request);
  const denied = requireAccount(account);
  if (denied || !account) return denied!;
  const params = await context.params;
  const workspaceId = serviceId(params.id);
  const orderId = serviceId(params.orderId);
  const body = await readServiceBody(request);
  const headers = { "cache-control": "no-store", "referrer-policy": "no-referrer" };
  if (!workspaceId || !orderId || !body || Object.hasOwn(body, "orderId")) return NextResponse.json({ error: "بيانات الرابط غير صالحة." }, { status: 400, headers });
  const result = await manageServiceStatusLink({ accountId: account.id, audience: "office", workspaceId }, { ...body, orderId });
  return NextResponse.json(result.body, { status: result.status, headers });
}

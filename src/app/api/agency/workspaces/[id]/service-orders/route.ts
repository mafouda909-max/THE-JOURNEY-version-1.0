import { NextResponse } from "next/server";
import { accountFromRequest, requireAccount } from "@/lib/identity";
import { executeServiceCommand, listServiceOrders } from "@/lib/service-fulfillment";
import { serviceId } from "@/lib/service-fulfillment-domain";
import { readServiceBody } from "@/lib/service-request";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const headers = { "cache-control": "no-store" };

export async function GET(request: Request, context: Context) {
  const account = await accountFromRequest(request);
  const denied = requireAccount(account);
  if (denied || !account) return denied!;
  const workspaceId = serviceId((await context.params).id);
  const rawOpportunity = new URL(request.url).searchParams.get("opportunityId");
  const opportunityId = rawOpportunity == null ? undefined : serviceId(rawOpportunity);
  if (!workspaceId || opportunityId === null) return NextResponse.json({ error: "معرف الطلب أو المكتب غير صالح." }, { status: 400, headers });
  const result = await listServiceOrders({ accountId: account.id, audience: "office", workspaceId }, opportunityId);
  return NextResponse.json(result.body, { status: result.status, headers });
}

export async function POST(request: Request, context: Context) {
  const account = await accountFromRequest(request);
  const denied = requireAccount(account);
  if (denied || !account) return denied!;
  const workspaceId = serviceId((await context.params).id);
  const body = await readServiceBody(request);
  if (!workspaceId || !body) return NextResponse.json({ error: "تعذر قراءة بيانات الإجراء." }, { status: 400, headers });
  const result = await executeServiceCommand({ accountId: account.id, audience: "office", workspaceId }, body);
  return NextResponse.json(result.body, { status: result.status, headers });
}

import { NextResponse } from "next/server";
import { accountFromRequest, requireAccount } from "@/lib/identity";
import { executeServiceCommand, listServiceOrders } from "@/lib/service-fulfillment";
import { readServiceBody } from "@/lib/service-request";

export const dynamic = "force-dynamic";
const headers = { "cache-control": "no-store" };

export async function GET(request: Request) {
  const account = await accountFromRequest(request);
  const denied = requireAccount(account);
  if (denied || !account) return denied!;
  const result = await listServiceOrders({ accountId: account.id, audience: "partner" });
  return NextResponse.json(result.body, { status: result.status, headers });
}

export async function POST(request: Request) {
  const account = await accountFromRequest(request);
  const denied = requireAccount(account);
  if (denied || !account) return denied!;
  const body = await readServiceBody(request);
  if (!body) return NextResponse.json({ error: "تعذر قراءة بيانات الإجراء." }, { status: 400, headers });
  const result = await executeServiceCommand({ accountId: account.id, audience: "partner" }, body);
  return NextResponse.json(result.body, { status: result.status, headers });
}

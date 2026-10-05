import { NextResponse } from "next/server";
import { accountFromRequest, requireAccount } from "@/lib/identity";
import { getServiceOperationsReport } from "@/lib/service-fulfillment";
import { serviceId } from "@/lib/service-fulfillment-domain";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const account = await accountFromRequest(request);
  const denied = requireAccount(account);
  if (denied || !account) return denied!;
  const workspaceId = serviceId((await context.params).id);
  const headers = { "cache-control": "no-store", "referrer-policy": "no-referrer" };
  if (!workspaceId) return NextResponse.json({ error: "معرف المكتب غير صالح." }, { status: 400, headers });
  const result = await getServiceOperationsReport({ accountId: account.id, audience: "office", workspaceId });
  return NextResponse.json(result.body, { status: result.status, headers });
}

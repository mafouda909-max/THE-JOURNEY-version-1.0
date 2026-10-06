import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getSilaProviderHealthPassive,
  probeSilaProviderHealth,
} from "@/lib/sila-provider-health";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  return NextResponse.json(getSilaProviderHealthPassive(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const report = await probeSilaProviderHealth();
  return NextResponse.json(report, {
    headers: { "Cache-Control": "no-store" },
  });
}

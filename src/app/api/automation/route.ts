import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { automationEngine } from "@/lib/automation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const result = await automationEngine.executeAutomationRoutines();
  return NextResponse.json({
    ok: true,
    automation: result,
  });
}

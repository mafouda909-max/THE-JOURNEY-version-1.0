import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getPlatformStatus, getToolMatrix } from "@/lib/tools";

export const dynamic = "force-dynamic";

// Tool registry is operational posture — admin eyes only.
export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const tools = await getToolMatrix();
  return NextResponse.json({
    platform: await getPlatformStatus(),
    tools,
    connected: tools.filter((t) => t.status === "CONNECTED").length,
    configured: tools.filter((t) => t.status === "CONFIGURED").length,
    missing: tools.filter((t) => t.status === "NOT_CONFIGURED").length,
  });
}

// Explicit, audited, read-only health re-probe (never a write action).
export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const tools = await getToolMatrix();
  await db.insert(auditLog).values({
    actor: "admin",
    action: "tool_health_probe",
    targetType: "system",
    targetId: 0,
    reason: null,
    prevState: null,
    newState: null,
    meta: tools.map((t) => `${t.key}:${t.status}`).join(" | ").slice(0, 220),
  });
  return NextResponse.json({ ok: true, tools });
}

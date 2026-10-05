import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { requireAdmin, adminKeyMatches } from "@/lib/auth";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";
import { getPlatformStatus, getToolMatrix } from "@/lib/tools";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store" };

// Tool registry is operational posture — admin eyes only.
export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const tools = await getToolMatrix();
    return NextResponse.json({
      platform: await getPlatformStatus(),
      tools,
      connected: tools.filter((t) => t.status === "CONNECTED").length,
      configured: tools.filter((t) => t.status === "CONFIGURED").length,
      missing: tools.filter((t) => t.status === "NOT_CONFIGURED").length,
    }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "تعذر تحميل حالة التشغيل. أعد المحاولة بعد قليل." }, { status: 503, headers: NO_STORE });
  }
}

// Provider probes are read-only; the audit insert is the first-party write.
export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin) || (!origin && !adminKeyMatches(request.headers.get("x-admin-key")))) {
    return NextResponse.json({ error: "ابدأ الفحص من لوحة إدارة صلة." }, { status: 403, headers: NO_STORE });
  }
  const limit = rateLimiter.checkRateLimit(`capability-probe:${clientIpFromRequest(request)}`, 5, 60);
  if (!limit.allowed) return NextResponse.json({ error: "فحوصات كثيرة — حاول بعد قليل." }, { status: 429, headers: { ...NO_STORE, "Retry-After": String(limit.resetSeconds) } });

  try {
    const tools = await getToolMatrix(true);
    await db.insert(auditLog).values({
      actor: "admin",
      action: "tool_health_probe",
      targetType: "system",
      targetId: 0,
      reason: null,
      prevState: null,
      newState: null,
      meta: `ready=${tools.filter((t) => t.ready).length};planned=${tools.filter((t) => t.status === "PLANNED").length};blocked=${tools.filter((t) => !t.ready && t.status !== "PLANNED").length};failed=${tools.filter((t) => t.status === "DEGRADED").map((t) => t.id).join(",")}`.slice(0, 220),
    });
    return NextResponse.json({ ok: true, tools }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "تعذر إتمام الفحص وتسجيله. أعد المحاولة بعد قليل." }, { status: 503, headers: NO_STORE });
  }
}

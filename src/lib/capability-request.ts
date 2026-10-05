import { NextResponse } from "next/server";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";

// Route ownership/roles are checked separately before this cost boundary.
// This local budget is a fallback; provider account quotas remain the hard
// ceiling across serverless instances. It grants no provider permissions.
export function guardCapabilityRequest(request: Request, capability: "ai_draft" | "ai_documents", accountScope: number): NextResponse | null {
  const headers = { "Cache-Control": "private, no-store" };
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "ابدأ الطلب من حسابك في صلة." }, { status: 403, headers });
  }
  const limit = capability === "ai_documents" ? 2 : 8;
  const window = capability === "ai_documents" ? 900 : 60;
  const budgets = [
    rateLimiter.checkRateLimit(`capability:${capability}:account:${accountScope}`, limit, window),
    rateLimiter.checkRateLimit(`capability:${capability}:ip:${clientIpFromRequest(request)}`, limit * 2, window),
  ];
  const blocked = budgets.find((budget) => !budget.allowed);
  return blocked ? NextResponse.json({ error: "طلبات كثيرة — حاول بعد قليل." }, { status: 429, headers: { ...headers, "Retry-After": String(blocked.resetSeconds) } }) : null;
}

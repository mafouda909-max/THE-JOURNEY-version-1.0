import { NextResponse, after } from "next/server";
import { travelReadinessEngine } from "@/lib/travel-readiness";
import { trackEvent } from "@/lib/data";
import { parseReadinessInput } from "@/lib/readiness-contract";
import { TravelIntelUnavailable } from "@/lib/travel-intel";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limit = rateLimiter.checkRateLimit(
    `travel-readiness:${clientIpFromRequest(request)}`,
    20,
    600,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "تم تجاوز عدد محاولات الفحص مؤقتًا. حاول لاحقًا." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.resetSeconds) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = parseReadinessInput(body);
  if (!input) return NextResponse.json({ error: "أدخل الجنسية والوجهة وصلاحية الجواز وتاريخًا صالحًا إن حددته." }, { status: 422 });
  const { nationality, destination, passportValidityMonths, transitCountry, travelPurpose, travelDate } = input;
  after(() => trackEvent("readiness_started", { meta: JSON.stringify({ hasTransit: Boolean(transitCountry) }) }, 2000));
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new TravelIntelUnavailable("TIMEOUT")); }, 18_000);
    });
    const result = await Promise.race([
      travelReadinessEngine.evaluateReadiness({ nationality, destination, passportValidityMonths, transitCountry, travelPurpose, travelDate }, AbortSignal.any([request.signal, controller.signal])),
      deadline,
    ]);
    after(() => trackEvent("readiness_completed", { meta: JSON.stringify({ status: result.status, checklistCount: result.checklist.length, warningCount: result.warnings.length }) }, 2000));
    return NextResponse.json({ ...result, disclosure: "هذا فحص جاهزية معلوماتي ضمن البنود المعروضة، وليس تصريح سفر أو ضمان دخول. أكد القواعد من مصدرها قبل الحجز والسفر." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = controller.signal.aborted || request.signal.aborted ? "TIMEOUT" : error instanceof TravelIntelUnavailable ? error.code : "DATA_UNAVAILABLE";
    // Fixed codes only: provider/database exception objects may contain secrets.
    return NextResponse.json({ error: code === "TIMEOUT" ? "استغرق فحص المصادر وقتًا طويلًا. لم تصدر نتيجة؛ حاول مجددًا." : "تعذر فحص المصادر حاليًا. لم تصدر نتيجة؛ حاول مجددًا.", code }, { status: code === "TIMEOUT" ? 504 : 503, headers: { "Retry-After": "15", "Cache-Control": "no-store" } });
  } finally { clearTimeout(timer); }
}

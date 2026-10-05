import { NextResponse } from "next/server";
import { travelReadinessEngine } from "@/lib/travel-readiness";
import { trackEvent } from "@/lib/data";
import { clientIpFromRequest, rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function clean(value: unknown, max = 100): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

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

  const data = (body ?? {}) as Record<string, unknown>;
  const nationality = clean(data.nationality, 80);
  const destination = clean(data.destination, 80);
  const transitCountry = clean(data.transitCountry, 80) || undefined;
  const passportValidityMonths = Number(data.passportValidityMonths);

  if (nationality.length < 2 || destination.length < 2) {
    return NextResponse.json(
      { error: "أدخل الجنسية والوجهة بوضوح." },
      { status: 422 },
    );
  }
  if (
    !Number.isFinite(passportValidityMonths) ||
    passportValidityMonths < 0 ||
    passportValidityMonths > 120
  ) {
    return NextResponse.json(
      { error: "أدخل عدد الأشهر المتبقية في صلاحية الجواز." },
      { status: 422 },
    );
  }

  await trackEvent("readiness_started", {
    meta: JSON.stringify({
      hasTransit: Boolean(transitCountry),
    }),
  });

  const result = await travelReadinessEngine.evaluateReadiness({
    nationality,
    destination,
    passportValidityMonths,
    transitCountry,
  });

  await trackEvent("readiness_completed", {
    meta: JSON.stringify({
      status: result.status,
      checklistCount: result.checklist.length,
      warningCount: result.warnings.length,
    }),
  });

  return NextResponse.json({
    ...result,
    disclosure:
      "هذا فحص جاهزية معلوماتي. اشتراطات الدخول قد تتغير ويجب تأكيدها من المصدر الرسمي المناسب قبل السفر.",
  });
}

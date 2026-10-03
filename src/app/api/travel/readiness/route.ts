import { NextResponse } from "next/server";
import { travelReadinessEngine } from "@/lib/travel-readiness";

export const dynamic = "force-dynamic";

function clean(value: unknown, max = 100): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
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

  const result = await travelReadinessEngine.evaluateReadiness({
    nationality,
    destination,
    passportValidityMonths,
    transitCountry,
  });

  return NextResponse.json({
    ...result,
    disclosure:
      "هذا فحص جاهزية معلوماتي. اشتراطات الدخول قد تتغير ويجب تأكيدها من المصدر الرسمي المناسب قبل السفر.",
  });
}

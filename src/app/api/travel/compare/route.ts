import { NextResponse } from "next/server";
import { compareFlightOffers } from "@/lib/travel-comparison";
import { searchAllFlightSuppliers } from "@/lib/travel-suppliers";
import type { FlightSearchInput } from "@/lib/travel-suppliers/types";

export const dynamic = "force-dynamic";

const IATA = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function boolParam(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export async function GET(request: Request) {
  if (process.env.FLIGHT_COMPARE_ENABLED !== "true") {
    return NextResponse.json(
      {
        featureEnabled: false,
        count: 0,
        comparison: [],
        error: "مقارنة الرحلات الحية غير مفعّلة في هذه البيئة حتى ينجح فحص المورد.",
      },
      {
        status: 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const originIata = (searchParams.get("origin") ?? "").toUpperCase();
  const destinationIata = (searchParams.get("destination") ?? "").toUpperCase();
  const departureDate = searchParams.get("departure") ?? "";
  const returnDate = searchParams.get("return") ?? undefined;
  const currency = (searchParams.get("currency") ?? "EGP").toUpperCase();
  const adults = Number(searchParams.get("adults") ?? 1);
  const nonStop = boolParam(searchParams.get("nonStop"));

  if (!IATA.test(originIata) || !IATA.test(destinationIata)) {
    return NextResponse.json(
      { error: "استخدم كود مطار IATA من 3 أحرف مثل CAI أو IST." },
      { status: 422 },
    );
  }

  if (!DATE.test(departureDate) || (returnDate && !DATE.test(returnDate))) {
    return NextResponse.json(
      { error: "تاريخ السفر غير صالح." },
      { status: 422 },
    );
  }

  if (!Number.isInteger(adults) || adults < 1 || adults > 9) {
    return NextResponse.json(
      { error: "عدد المسافرين البالغين يجب أن يكون بين 1 و9." },
      { status: 422 },
    );
  }

  const input: FlightSearchInput = {
    originIata,
    destinationIata,
    departureDate,
    returnDate,
    adults,
    currency,
    nonStop,
    max: 20,
  };

  const suppliers = await searchAllFlightSuppliers(input);
  const offers = suppliers.flatMap((supplier) => supplier.offers);
  const comparison = compareFlightOffers(offers);

  return NextResponse.json(
    {
      query: input,
      checkedAt: new Date().toISOString(),
      supplierStatus: suppliers.map((supplier) => ({
        provider: supplier.provider,
        configured: supplier.configured,
        connected: supplier.connected,
        checkedAt: supplier.checkedAt,
        warnings: supplier.warnings,
      })),
      count: comparison.length,
      comparison,
      disclosure:
        "صلة تقارن النتائج المتاحة من المصادر المتصلة فقط. السعر والتوافر وقواعد الأجرة تحتاج إعادة تحقق قبل الالتزام.",
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}

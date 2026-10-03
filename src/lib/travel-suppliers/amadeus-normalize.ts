import type {
  CanonicalFlightOffer,
  CanonicalFlightSegment,
  FlightSearchInput,
} from "@/lib/travel-suppliers/types";

function parseDurationMinutes(value?: string): number | null {
  if (!value) return null;
  const match = value.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?$/);
  if (!match) return null;
  return (
    Number(match[1] ?? 0) * 1440 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0)
  );
}

function finitePrice(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function numberOrUndefined(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

type Bag = NonNullable<CanonicalFlightOffer["includedCheckedBags"]>;

function normalizedBag(value: any): Bag | null {
  if (!value || typeof value !== "object") return null;
  const quantity = numberOrUndefined(value.quantity);
  const weightKg =
    String(value.weightUnit ?? "").toUpperCase() === "KG"
      ? numberOrUndefined(value.weight)
      : undefined;
  if (quantity === undefined && weightKg === undefined) return null;
  return {
    ...(quantity !== undefined ? { quantity } : {}),
    ...(weightKg !== undefined ? { weightKg } : {}),
  };
}

function sameBag(a: Bag, b: Bag): boolean {
  return a.quantity === b.quantity && a.weightKg === b.weightKg;
}

export function normalizeAmadeusOffer(
  raw: any,
  input: FlightSearchInput,
  checkedAt: string,
): CanonicalFlightOffer | null {
  const priceTotal = finitePrice(raw?.price?.grandTotal ?? raw?.price?.total);
  const currency = String(raw?.price?.currency ?? input.currency ?? "").toUpperCase();
  if (priceTotal === null || !/^[A-Z]{3}$/.test(currency)) return null;

  const itineraries = Array.isArray(raw?.itineraries) ? raw.itineraries : [];
  if (itineraries.length === 0) return null;

  // A round-trip search is only comparable when the supplier actually returned
  // both journeys. Never pair a round-trip total price with an outbound-only path.
  if (input.returnDate && itineraries.length < 2) return null;

  const segments: CanonicalFlightSegment[] = [];
  let totalStops = 0;
  const itineraryDurations: number[] = [];

  for (let itineraryIndex = 0; itineraryIndex < itineraries.length; itineraryIndex += 1) {
    const itinerary = itineraries[itineraryIndex];
    const rawSegments = Array.isArray(itinerary?.segments) ? itinerary.segments : [];
    if (rawSegments.length === 0) return null;

    const itineraryDuration = parseDurationMinutes(itinerary?.duration);
    if (itineraryDuration !== null) itineraryDurations.push(itineraryDuration);

    totalStops += Math.max(0, rawSegments.length - 1);

    for (const segment of rawSegments) {
      const departureIata = String(segment?.departure?.iataCode ?? "");
      const arrivalIata = String(segment?.arrival?.iataCode ?? "");
      const departureAt = String(segment?.departure?.at ?? "");
      const arrivalAt = String(segment?.arrival?.at ?? "");
      if (!departureIata || !arrivalIata || !departureAt || !arrivalAt) return null;

      segments.push({
        departureIata,
        arrivalIata,
        departureAt,
        arrivalAt,
        carrierCode: String(segment?.carrierCode ?? ""),
        flightNumber: String(segment?.number ?? ""),
        aircraftCode:
          typeof segment?.aircraft?.code === "string" ? segment.aircraft.code : undefined,
        durationMinutes: parseDurationMinutes(segment?.duration) ?? undefined,
        itineraryIndex,
      });
    }
  }

  const travelerPricings = Array.isArray(raw?.travelerPricings) ? raw.travelerPricings : [];
  const fareDetails = travelerPricings.flatMap((pricing: any) =>
    Array.isArray(pricing?.fareDetailsBySegment) ? pricing.fareDetailsBySegment : [],
  );

  const bags: Array<Bag | null> = fareDetails.map((fare: any) => normalizedBag(fare?.includedCheckedBags));
  const includedCheckedBags =
    bags.length > 0 &&
    bags.every((bag): bag is Bag => bag !== null) &&
    bags.every((bag) => sameBag(bag, bags[0]!))
      ? bags[0]
      : undefined;

  const cabins: string[] = fareDetails
    .map((fare: any) => (typeof fare?.cabin === "string" ? fare.cabin.trim() : ""))
    .filter(Boolean);
  const cabin =
    cabins.length === fareDetails.length &&
    cabins.length > 0 &&
    cabins.every((value) => value === cabins[0])
      ? cabins[0]
      : undefined;

  const durationMinutes =
    itineraryDurations.length === itineraries.length
      ? itineraryDurations.reduce((sum, value) => sum + value, 0)
      : null;

  const baggageNeedsConfirmation =
    fareDetails.length > 0 && includedCheckedBags === undefined;

  return {
    id: `amadeus:${String(raw?.id ?? crypto.randomUUID())}`,
    source: {
      provider: "Amadeus",
      kind: "GDS",
      authorityLevel: 4,
      checkedAt,
      reference: typeof raw?.source === "string" ? raw.source : undefined,
    },
    originIata: input.originIata,
    destinationIata: input.destinationIata,
    departureDate: input.departureDate,
    returnDate: input.returnDate,
    price: { total: priceTotal, currency },
    travelerCount: input.adults,
    durationMinutes,
    stops: totalStops,
    validatingAirlines: Array.isArray(raw?.validatingAirlineCodes)
      ? raw.validatingAirlineCodes.map(String)
      : [],
    cabin,
    includedCheckedBags,
    fare: {
      refundable: null,
      changeable: null,
      sourceNote:
        "قواعد الاسترداد والتغيير تحتاج تسعير/قواعد أجرة مؤكدة من المزوّد قبل الالتزام.",
    },
    segments,
    freshnessMinutes: 0,
    warnings: [
      "السعر والتوافر يتغيران؛ أعد التحقق قبل الالتزام أو الدفع.",
      "هذه نتيجة مورد طيران وليست بديلاً عن شروط التذكرة النهائية.",
      ...(baggageNeedsConfirmation
        ? ["بيانات الأمتعة ليست متطابقة عبر كل قطاعات الرحلة؛ يلزم تأكيدها من شروط الأجرة."]
        : []),
    ],
  };
}

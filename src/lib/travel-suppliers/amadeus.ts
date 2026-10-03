import "server-only";

import type {
  CanonicalFlightOffer,
  CanonicalFlightSegment,
  FlightSearchInput,
  SupplierSearchResult,
  TravelSupplierAdapter,
} from "@/lib/travel-suppliers/types";

type TokenCache = {
  value: string;
  expiresAt: number;
} | null;

let tokenCache: TokenCache = null;

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function baseUrl(): string {
  const explicit = env("AMADEUS_BASE_URL");
  if (explicit) return explicit.replace(/\/$/, "");
  return env("AMADEUS_ENV").toLowerCase() === "production"
    ? "https://api.amadeus.com"
    : "https://test.api.amadeus.com";
}

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

function normalizeOffer(raw: any, input: FlightSearchInput): CanonicalFlightOffer | null {
  const priceTotal = finitePrice(raw?.price?.grandTotal ?? raw?.price?.total);
  const currency = String(raw?.price?.currency ?? input.currency ?? "").toUpperCase();
  const itinerary = Array.isArray(raw?.itineraries) ? raw.itineraries : [];
  const firstItinerary = itinerary[0];
  const firstSegments = Array.isArray(firstItinerary?.segments) ? firstItinerary.segments : [];
  if (priceTotal === null || !currency || firstSegments.length === 0) return null;

  const segments: CanonicalFlightSegment[] = [];
  for (const segment of firstSegments) {
    const departureIata = String(segment?.departure?.iataCode ?? "");
    const arrivalIata = String(segment?.arrival?.iataCode ?? "");
    const departureAt = String(segment?.departure?.at ?? "");
    const arrivalAt = String(segment?.arrival?.at ?? "");
    if (!departureIata || !arrivalIata || !departureAt || !arrivalAt) continue;
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
    });
  }
  if (segments.length === 0) return null;

  const travelerPricing = Array.isArray(raw?.travelerPricings) ? raw.travelerPricings[0] : null;
  const fareDetails = Array.isArray(travelerPricing?.fareDetailsBySegment)
    ? travelerPricing.fareDetailsBySegment
    : [];
  const firstFare = fareDetails[0];

  const checked = firstFare?.includedCheckedBags;
  const includedCheckedBags =
    checked && typeof checked === "object"
      ? {
          quantity: numberOrUndefined(checked.quantity),
          weightKg:
            String(checked.weightUnit ?? "").toUpperCase() === "KG"
              ? numberOrUndefined(checked.weight)
              : undefined,
        }
      : undefined;

  const checkedAt = new Date().toISOString();
  const allSegments = itinerary.flatMap((item: any) =>
    Array.isArray(item?.segments) ? item.segments : [],
  );
  const totalStops = Math.max(0, allSegments.length - itinerary.length);

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
    durationMinutes: parseDurationMinutes(firstItinerary?.duration),
    stops: totalStops,
    validatingAirlines: Array.isArray(raw?.validatingAirlineCodes)
      ? raw.validatingAirlineCodes.map(String)
      : [],
    cabin: typeof firstFare?.cabin === "string" ? firstFare.cabin : undefined,
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
    ],
  };
}

export class AmadeusSupplierAdapter implements TravelSupplierAdapter {
  readonly key = "amadeus";
  readonly label = "Amadeus Self-Service";

  isConfigured(): boolean {
    return Boolean(env("AMADEUS_CLIENT_ID") && env("AMADEUS_CLIENT_SECRET"));
  }

  private async accessToken(): Promise<string> {
    if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
      return tokenCache.value;
    }

    if (!this.isConfigured()) {
      throw new Error("AMADEUS_NOT_CONFIGURED");
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env("AMADEUS_CLIENT_ID"),
      client_secret: env("AMADEUS_CLIENT_SECRET"),
    });

    const response = await fetch(`${baseUrl()}/v1/security/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`AMADEUS_AUTH_${response.status}`);
    }

    const json = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) throw new Error("AMADEUS_AUTH_TOKEN_MISSING");

    tokenCache = {
      value: json.access_token,
      expiresAt: Date.now() + Math.max(60, Number(json.expires_in ?? 900)) * 1000,
    };
    return tokenCache.value;
  }

  async probe() {
    const started = Date.now();
    if (!this.isConfigured()) return { connected: false, latencyMs: null };
    try {
      await this.accessToken();
      return { connected: true, latencyMs: Date.now() - started };
    } catch (error) {
      return {
        connected: false,
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : "AMADEUS_PROBE_FAILED",
      };
    }
  }

  async searchFlights(input: FlightSearchInput): Promise<SupplierSearchResult> {
    const checkedAt = new Date().toISOString();
    if (!this.isConfigured()) {
      return {
        provider: this.label,
        configured: false,
        connected: false,
        checkedAt,
        offers: [],
        warnings: ["Amadeus غير مهيأ بعد. أضف مفاتيح المورد إلى بيئة الخادم."],
      };
    }

    try {
      const token = await this.accessToken();
      const params = new URLSearchParams({
        originLocationCode: input.originIata.toUpperCase(),
        destinationLocationCode: input.destinationIata.toUpperCase(),
        departureDate: input.departureDate,
        adults: String(input.adults),
        max: String(Math.min(Math.max(input.max ?? 20, 1), 50)),
      });
      if (input.returnDate) params.set("returnDate", input.returnDate);
      if (input.currency) params.set("currencyCode", input.currency.toUpperCase());
      if (input.nonStop !== undefined) params.set("nonStop", String(input.nonStop));

      const response = await fetch(
        `${baseUrl()}/v2/shopping/flight-offers?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        return {
          provider: this.label,
          configured: true,
          connected: true,
          checkedAt,
          offers: [],
          warnings: ["تعذر إرجاع نتائج الرحلات من المورد لهذه المعايير."],
          error: `AMADEUS_SEARCH_${response.status} ${detail.slice(0, 180)}`.trim(),
        };
      }

      const json = (await response.json()) as { data?: unknown[] };
      const offers = (Array.isArray(json.data) ? json.data : [])
        .map((item) => normalizeOffer(item, input))
        .filter((item): item is CanonicalFlightOffer => item !== null);

      return {
        provider: this.label,
        configured: true,
        connected: true,
        checkedAt,
        offers,
        warnings:
          offers.length === 0
            ? ["لا توجد نتائج مطابقة من Amadeus في هذه اللحظة."]
            : ["نتائج المورد لحظية؛ السعر النهائي يحتاج إعادة تحقق قبل الالتزام."],
      };
    } catch (error) {
      return {
        provider: this.label,
        configured: true,
        connected: false,
        checkedAt,
        offers: [],
        warnings: ["تعذر الاتصال بمورد الرحلات الآن."],
        error: error instanceof Error ? error.message : "AMADEUS_SEARCH_FAILED",
      };
    }
  }
}

export const amadeusSupplier = new AmadeusSupplierAdapter();

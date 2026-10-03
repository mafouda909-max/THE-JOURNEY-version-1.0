import "server-only";

import type {
  FlightSearchInput,
  SupplierSearchResult,
  TravelSupplierAdapter,
} from "@/lib/travel-suppliers/types";
import { normalizeAmadeusOffer } from "@/lib/travel-suppliers/amadeus-normalize";

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
        .map((item) => normalizeAmadeusOffer(item, input, checkedAt))
        .filter((item): item is NonNullable<typeof item> => item !== null);

      return {
        provider: this.label,
        configured: true,
        connected: true,
        checkedAt,
        offers,
        warnings:
          offers.length === 0
            ? ["لا توجد نتائج مكتملة قابلة للمقارنة من Amadeus في هذه اللحظة."]
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

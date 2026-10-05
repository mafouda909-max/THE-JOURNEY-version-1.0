import type { WebSearchResponse } from "@/lib/providers/web";
import type {
  FlightSearchInput,
  SupplierSearchResult,
} from "@/lib/travel-suppliers/types";
import type { AgentEvidence, AgentToolDefinition } from "./contracts";
import { AgentToolRegistry } from "./tool-registry";

export const TRAVEL_WEB_SEARCH_TOOL = "travel.web.search";
export const TRAVEL_FLIGHT_SEARCH_TOOL = "travel.flight.search";

export interface TravelReadToolDependencies {
  searchWeb: (
    query: string,
    options: { maxResults: number; searchDepth: "basic" | "advanced" },
  ) => Promise<WebSearchResponse>;
  searchFlights: (input: FlightSearchInput) => Promise<SupplierSearchResult>;
}

const webTool: AgentToolDefinition = {
  name: TRAVEL_WEB_SEARCH_TOOL,
  description: "Search source-aware public travel information.",
  effects: ["read"],
  risk: "low",
  requiresAuth: false,
  requiresApproval: false,
  allowedActors: ["traveler", "agent", "admin", "system"],
};

const flightTool: AgentToolDefinition = {
  name: TRAVEL_FLIGHT_SEARCH_TOOL,
  description: "Search canonical flight offers from configured travel suppliers.",
  effects: ["read"],
  risk: "medium",
  requiresAuth: false,
  requiresApproval: false,
  allowedActors: ["traveler", "agent", "admin", "system"],
};

function requiredString(
  args: Record<string, unknown>,
  key: string,
  maxLength: number,
): string {
  const value = args[key];
  const errorCode = `INVALID_${key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toUpperCase()}`;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(errorCode);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(errorCode);
  }
  return trimmed;
}

function optionalBoolean(
  args: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new Error(`INVALID_${key.toUpperCase()}`);
  }
  return value;
}

function boundedInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  errorCode: string,
): number {
  if (value === undefined) return fallback;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(errorCode);
  }
  return value;
}

function iata(value: string, errorCode: string): string {
  const normalized = value.toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new Error(errorCode);
  return normalized;
}

function isoDate(value: string, errorCode: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(errorCode);
  return value;
}

function webEvidence(response: WebSearchResponse): AgentEvidence[] {
  return response.results
    .filter((result) => /^https?:\/\//i.test(result.url))
    .map((result) => ({
      source: result.url,
      sourceType: "web" as const,
      observedAt: response.retrievedAt,
      freshnessStatus: response.freshness === "fresh" ? "fresh" as const : "unknown" as const,
      supports: result.title ? [result.title] : undefined,
    }));
}

function supplierEvidence(result: SupplierSearchResult): AgentEvidence[] {
  return [
    {
      source: `supplier:${result.provider}`,
      sourceType: "supplier",
      observedAt: result.checkedAt,
      freshnessStatus: result.connected ? "fresh" : "unknown",
      supports: result.offers.slice(0, 20).map((offer) => offer.id),
    },
  ];
}

export function defaultTravelReadToolDependencies(): TravelReadToolDependencies {
  return {
    async searchWeb(query, options) {
      const { travelWebProvider } = await import("@/lib/providers/web");
      return travelWebProvider.search(query, options);
    },
    async searchFlights(input) {
      const { amadeusSupplier } = await import("@/lib/travel-suppliers/amadeus");
      return amadeusSupplier.searchFlights(input);
    },
  };
}

export function registerTravelReadTools(
  registry: AgentToolRegistry,
  dependencies: TravelReadToolDependencies = defaultTravelReadToolDependencies(),
): void {
  registry.register(webTool, async (args) => {
    const query = requiredString(args, "query", 300);
    const maxResults = boundedInteger(
      args.maxResults,
      5,
      1,
      8,
      "INVALID_MAX_RESULTS",
    );
    const searchDepth =
      args.searchDepth === "advanced" ? "advanced" : "basic";

    const response = await dependencies.searchWeb(query, {
      maxResults,
      searchDepth,
    });

    return {
      output: response,
      evidence: webEvidence(response),
    };
  });

  registry.register(flightTool, async (args) => {
    const originIata = iata(
      requiredString(args, "originIata", 3),
      "INVALID_ORIGIN_IATA",
    );
    const destinationIata = iata(
      requiredString(args, "destinationIata", 3),
      "INVALID_DESTINATION_IATA",
    );
    const departureDate = isoDate(
      requiredString(args, "departureDate", 10),
      "INVALID_DEPARTURE_DATE",
    );

    const rawReturnDate =
      typeof args.returnDate === "string" && args.returnDate.trim()
        ? args.returnDate.trim()
        : undefined;
    const returnDate = rawReturnDate
      ? isoDate(rawReturnDate, "INVALID_RETURN_DATE")
      : undefined;

    const adults = boundedInteger(args.adults, 1, 1, 9, "INVALID_ADULTS");
    const max = boundedInteger(args.max, 20, 1, 20, "INVALID_MAX");
    const currency =
      typeof args.currency === "string" && /^[A-Za-z]{3}$/.test(args.currency)
        ? args.currency.toUpperCase()
        : undefined;

    const input: FlightSearchInput = {
      originIata,
      destinationIata,
      departureDate,
      returnDate,
      adults,
      max,
      currency,
      nonStop: optionalBoolean(args, "nonStop"),
    };

    const result = await dependencies.searchFlights(input);
    return {
      output: result,
      evidence: supplierEvidence(result),
    };
  });
}

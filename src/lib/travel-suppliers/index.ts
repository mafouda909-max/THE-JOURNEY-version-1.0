import type {
  FlightSearchInput,
  SupplierSearchResult,
  TravelSupplierAdapter,
} from "@/lib/travel-suppliers/types";
import { searchFlights } from "@/lib/provider-gateway";
import { capabilityRuntime } from "@/lib/capabilities/production";

const adapters: TravelSupplierAdapter[] = [{
  key: "amadeus",
  label: "Amadeus Self-Service",
  isConfigured: () => Boolean(process.env.AMADEUS_CLIENT_ID?.trim() && process.env.AMADEUS_CLIENT_SECRET?.trim()),
  async probe() {
    const state = await capabilityRuntime.probe("flights");
    return { connected: state.ready, latencyMs: state.latencyMs, ...(state.failureCode ? { error: state.failureCode } : {}) };
  },
  searchFlights,
}];

export function getTravelSupplierAdapters(): TravelSupplierAdapter[] {
  return [...adapters];
}

export function getTravelSupplierAdapter(key: string): TravelSupplierAdapter | null {
  return adapters.find((adapter) => adapter.key === key) ?? null;
}

export async function searchAllFlightSuppliers(
  input: FlightSearchInput,
): Promise<SupplierSearchResult[]> {
  return Promise.all(adapters.map((adapter) => adapter.searchFlights(input)));
}

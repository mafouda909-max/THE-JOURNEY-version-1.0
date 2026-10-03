import type {
  FlightSearchInput,
  SupplierSearchResult,
  TravelSupplierAdapter,
} from "@/lib/travel-suppliers/types";
import { amadeusSupplier } from "@/lib/travel-suppliers/amadeus";

const adapters: TravelSupplierAdapter[] = [amadeusSupplier];

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

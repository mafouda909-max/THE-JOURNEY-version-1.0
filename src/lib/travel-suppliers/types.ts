export type SupplierKind = "GDS" | "NDC" | "AIRLINE" | "MARKETPLACE";

export type FlightSource = {
  provider: string;
  kind: SupplierKind;
  authorityLevel: 1 | 2 | 3 | 4 | 5;
  checkedAt: string;
  reference?: string;
};

export type CanonicalFlightSegment = {
  departureIata: string;
  arrivalIata: string;
  departureAt: string;
  arrivalAt: string;
  carrierCode: string;
  flightNumber: string;
  aircraftCode?: string;
  durationMinutes?: number;
};

export type CanonicalFlightOffer = {
  id: string;
  source: FlightSource;
  originIata: string;
  destinationIata: string;
  departureDate: string;
  returnDate?: string;
  price: {
    total: number;
    currency: string;
  };
  travelerCount: number;
  durationMinutes: number | null;
  stops: number;
  validatingAirlines: string[];
  cabin?: string;
  includedCheckedBags?: {
    quantity?: number;
    weightKg?: number;
  };
  fare: {
    refundable: boolean | null;
    changeable: boolean | null;
    sourceNote?: string;
  };
  segments: CanonicalFlightSegment[];
  freshnessMinutes: number;
  warnings: string[];
};

export type FlightSearchInput = {
  originIata: string;
  destinationIata: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  currency?: string;
  nonStop?: boolean;
  max?: number;
};

export type SupplierSearchResult = {
  provider: string;
  configured: boolean;
  connected: boolean;
  checkedAt: string;
  offers: CanonicalFlightOffer[];
  warnings: string[];
  error?: string;
};

export interface TravelSupplierAdapter {
  readonly key: string;
  readonly label: string;
  isConfigured(): boolean;
  probe(): Promise<{ connected: boolean; latencyMs: number | null; error?: string }>;
  searchFlights(input: FlightSearchInput): Promise<SupplierSearchResult>;
}

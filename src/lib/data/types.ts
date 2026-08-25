/**
 * Row shapes for public projection views (0100). snake_case mirrors SQL —
 * mapping stays 1:1 to avoid drift. Anon/public access ONLY (AD-05).
 */

export interface PublicOfferRow {
  id: string;
  title_ar: string;
  title_en: string | null;
  description_ar: string;
  description_en: string | null;
  trip_type: string;
  route_type: string | null;
  origin_city_id: string;
  origin_city_ar: string;
  origin_city_en: string;
  destination_city_id: string;
  destination_city_ar: string;
  destination_city_en: string;
  origin_airport_iata: string | null;
  destination_airport_iata: string | null;
  airline_id: string | null;
  airline_name_ar: string | null;
  airline_iata: string | null;
  departure_date: string | null;
  return_date: string | null;
  duration_days: number | null;
  flexible_dates: boolean;
  price_amount: number | string;
  currency: string;
  price_type: string;
  price_basis: string;
  includes: string[];
  excludes: string[];
  min_travelers: number;
  max_travelers: number | null;
  valid_from: string;
  valid_until: string;
  published_at: string | null;
  agent_id: string;
  agent_display_name: string;
  agent_avg_rating: number | null;
  agent_reviews_count: number | null;
  agent_response_rate_pct: number | null;
}

export interface PublicAgentProfileRow {
  id: string;
  display_name: string;
  business_name: string | null;
  bio_ar: string | null;
  bio_en: string | null;
  photo_url: string | null;
  city_name_ar: string | null;
  city_name_en: string | null;
  license_type: string;
  specialty_tags: string[];
  languages_spoken: string[];
  joined_at: string;
  avg_rating: number | null;
  reviews_count: number;
  published_offers_count: number;
}

/** Raised when Supabase env is not configured yet (pre-provisioning). */
export class DataSourceUnavailableError extends Error {
  constructor() {
    super("supabase-env-missing");
    this.name = "DataSourceUnavailableError";
  }
}

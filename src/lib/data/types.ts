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

export interface PublicPostRow {
  id: string;
  title: string;
  content: string;
  user_id: string;
  author_name: string;
  author_role: "traveler" | "agent" | "admin";
  agent_business_name: string | null;
  is_agent_verified: boolean | null;
  country_id: string | null;
  country_name_ar: string | null;
  country_name_en: string | null;
  city_id: string | null;
  city_name_ar: string | null;
  city_name_en: string | null;
  trip_type: string | null;
  tags: string[];
  media_urls: string[];
  likes_count: number;
  comments_count: number;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface PostCommentRow {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

export interface PublicVisaGuideRow {
  id: string;
  destination_country_id: string;
  destination_country_name_ar: string;
  destination_country_name_en: string;
  destination_country_iso2: string;
  origin_country_id: string | null;
  origin_country_name_ar: string | null;
  origin_country_name_en: string | null;
  origin_country_iso2: string | null;
  visa_type: "visa_free" | "e_visa" | "on_arrival" | "embassy_visa" | "eta";
  title_ar: string;
  title_en: string | null;
  summary_ar: string;
  summary_en: string | null;
  requirements_ar: string[];
  documents_required: string[];
  processing_time_days: number | null;
  validity_days: number | null;
  stay_duration_days: number | null;
  cost_estimate: number | null;
  currency: string;
  official_portal_url: string | null;
  official_source_name: string | null;
  is_official_verified: boolean;
  last_verified_at: string | null;
  notes_ar: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicRfqInquiryRow {
  id: string;
  contact_name: string;
  contact_phone?: string;
  contact_email?: string | null;
  origin_city_id: string | null;
  origin_city_name_ar: string | null;
  origin_city_name_en: string | null;
  destination_city_id: string | null;
  destination_city_name_ar: string | null;
  destination_city_name_en: string | null;
  trip_type: string;
  departure_date: string | null;
  return_date: string | null;
  flexible_dates: boolean;
  travelers_count: number;
  budget_amount: number | null;
  budget_currency: string;
  description: string;
  target_agent_id: string | null;
  target_agent_name: string | null;
  status: "open" | "quotes_received" | "accepted" | "closed" | "cancelled";
  quotes_count: number;
  created_at: string;
}

export interface RfqQuoteRow {
  id: string;
  inquiry_id: string;
  agent_id: string;
  agent_name: string;
  agent_business_name: string | null;
  quote_amount: number;
  currency: string;
  proposal_details: string;
  valid_until: string | null;
  status: "submitted" | "accepted" | "declined" | "expired";
  created_at: string;
}

/** Raised when Supabase env is not configured yet (pre-provisioning). */
export class DataSourceUnavailableError extends Error {
  constructor() {
    super("supabase-env-missing");
    this.name = "DataSourceUnavailableError";
  }
}

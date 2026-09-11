/**
 * Mirrors of the server payloads this client consumes.
 *
 * Shapes are derived from `src/app/api/**` responses and `src/db/schema.ts`;
 * `tests/mobile-contract.test.ts` (root suite) fails CI if the trip types,
 * currencies or health statuses drift from the server definitions.
 */

export type TripType = "umrah" | "package" | "visa" | "flight" | "hotel" | "cruise";
export type Currency = "SAR" | "AED" | "USD" | "EGP" | "EUR";
export type PriceType = "per_person" | "per_group" | "starting_from";
export type VerificationStatus = "pending" | "in_review" | "verified" | "rejected" | "suspended";
export type HealthStatus = "HEALTHY" | "DEGRADED" | "NOT_CONFIGURED" | "UNAVAILABLE";
export type ContactRequestStatus = "new" | "contacted" | "closed_won" | "closed_lost";

/** `serial` primary key — always a positive integer. */
export interface Offer {
  id: number;
  agentId: number;
  title: string;
  /** Nullable by design: the 42703 incident made this column optional, not absent. */
  titleEn: string | null;
  description: string;
  tripType: TripType;
  originCity: string;
  destinationCity: string;
  destinationCountry: string;
  destinationCountryEn: string;
  departureDate: string | null;
  durationDays: number | null;
  /** Integer major units (no minor-unit conversion is applied anywhere). */
  priceAmount: number;
  currency: Currency;
  priceType: PriceType;
  includes: string[];
  excludes: string[];
  minTravelers: number;
  maxTravelers: number;
  status: string;
  heroImage: string;
  isFeatured: boolean;
  viewCount: number;
  contactCount: number;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  agent?: Agent;
}

export interface Agent {
  id: number;
  displayName: string;
  latinName: string;
  bio: string;
  photoUrl: string;
  city: string;
  country: string;
  licenseType: "individual" | "agency";
  hasLicense: boolean;
  verificationStatus: VerificationStatus;
  specialtyTags: string[];
  languages: string[];
  /** 0–100 */
  responseRate: number;
  avgResponseHours: number;
  totalTrips: number;
  joinedAt: string;
  avgRating?: number;
  reviewCount?: number;
}

export interface OffersResponse {
  count: number;
  offers: Offer[];
}

export interface AgentsResponse {
  count: number;
  agents: Agent[];
}

export interface HealthResponse {
  status: HealthStatus;
  ok: boolean;
  error?: string;
  database?: { status: string; latencyMs: number };
  storage?: { status: string };
  timestamp: string;
}

/** POST /api/contact-requests — body the traveler can fill in from a phone. */
export interface ContactRequestPayload {
  offerId: number;
  travelerName: string;
  travelerEmail: string;
  travelerCount: number;
  travelDates?: string;
  message: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface ContactRequestAccepted {
  id: number;
  createdAt: string;
  status: ContactRequestStatus;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}

export function parseAgent(value: unknown): Agent | null {
  if (!isRecord(value) || typeof value.id !== "number") return null;
  return {
    id: value.id,
    displayName: asString(value.displayName),
    latinName: asString(value.latinName),
    bio: asString(value.bio),
    photoUrl: asString(value.photoUrl),
    city: asString(value.city),
    country: asString(value.country),
    licenseType: value.licenseType === "agency" ? "agency" : "individual",
    hasLicense: value.hasLicense === true,
    verificationStatus: isVerificationStatus(value.verificationStatus)
      ? value.verificationStatus
      : "pending",
    specialtyTags: asStringArray(value.specialtyTags),
    languages: asStringArray(value.languages),
    responseRate: asNumber(value.responseRate),
    avgResponseHours: asNumber(value.avgResponseHours, 24),
    totalTrips: asNumber(value.totalTrips),
    joinedAt: asString(value.joinedAt),
    avgRating: typeof value.avgRating === "number" ? value.avgRating : undefined,
    reviewCount: typeof value.reviewCount === "number" ? value.reviewCount : undefined,
  };
}

function isVerificationStatus(value: unknown): value is VerificationStatus {
  return (
    value === "pending" ||
    value === "in_review" ||
    value === "verified" ||
    value === "rejected" ||
    value === "suspended"
  );
}

export function parseOffer(value: unknown): Offer | null {
  if (!isRecord(value) || typeof value.id !== "number") return null;
  const agent = isRecord(value.agent) ? parseAgent(value.agent) : null;
  return {
    id: value.id,
    agentId: asNumber(value.agentId),
    title: asString(value.title),
    titleEn: asNullableString(value.titleEn),
    description: asString(value.description),
    tripType: (asString(value.tripType) as TripType) || "package",
    originCity: asString(value.originCity),
    destinationCity: asString(value.destinationCity),
    destinationCountry: asString(value.destinationCountry),
    destinationCountryEn: asString(value.destinationCountryEn),
    departureDate: asNullableString(value.departureDate),
    durationDays: typeof value.durationDays === "number" ? value.durationDays : null,
    priceAmount: asNumber(value.priceAmount),
    currency: (asString(value.currency) as Currency) || "SAR",
    priceType: (asString(value.priceType) as PriceType) || "per_person",
    includes: asStringArray(value.includes),
    excludes: asStringArray(value.excludes),
    minTravelers: asNumber(value.minTravelers, 1),
    maxTravelers: asNumber(value.maxTravelers, 1),
    status: asString(value.status, "published"),
    heroImage: asString(value.heroImage),
    isFeatured: value.isFeatured === true,
    viewCount: asNumber(value.viewCount),
    contactCount: asNumber(value.contactCount),
    publishedAt: asNullableString(value.publishedAt),
    expiresAt: asNullableString(value.expiresAt),
    createdAt: asString(value.createdAt),
    ...(agent ? { agent } : {}),
  };
}

export function parseOffersResponse(value: unknown): Offer[] {
  if (!isRecord(value) || !Array.isArray(value.offers)) return [];
  return value.offers
    .map(parseOffer)
    .filter((offer): offer is Offer => offer !== null);
}

export function parseAgentsResponse(value: unknown): Agent[] {
  if (!isRecord(value) || !Array.isArray(value.agents)) return [];
  return value.agents.map(parseAgent).filter((agent): agent is Agent => agent !== null);
}

export function parseHealthResponse(value: unknown): HealthResponse {
  const status: HealthStatus = isRecord(value) && isHealthStatus(value.status) ? value.status : "UNAVAILABLE";
  return {
    status,
    ok: isRecord(value) ? value.ok === true : false,
    error: asNullableString(isRecord(value) ? value.error : null) ?? undefined,
    database: isRecord(value) && isRecord(value.database)
      ? {
          status: asString(value.database.status, "UNAVAILABLE"),
          latencyMs: asNumber(value.database.latencyMs),
        }
      : undefined,
    storage: isRecord(value) && isRecord(value.storage)
      ? { status: asString(value.storage.status, "NOT_CONFIGURED") }
      : undefined,
    timestamp: asString(isRecord(value) ? value.timestamp : null),
  };
}

function isHealthStatus(value: unknown): value is HealthStatus {
  return (
    value === "HEALTHY" ||
    value === "DEGRADED" ||
    value === "NOT_CONFIGURED" ||
    value === "UNAVAILABLE"
  );
}

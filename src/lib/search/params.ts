/**
 * URL-driven search state — pure codec (AD-11 query model).
 * Server Components receive Next's searchParams record; UI mutates the URL;
 * the query layer (Phase B) consumes parsed filters. Single source of truth:
 * the URL.
 */

export const TRIP_TYPES = [
  "flight",
  "package",
  "visa",
  "umrah",
  "hotel",
  "cruise",
  "custom",
] as const;
export type TripType = (typeof TRIP_TYPES)[number];

export type RouteType = "direct" | "transit";

export type SortOption =
  | "relevance" // default: verified-first (view invariant) → newest (AD-11)
  | "newest"
  | "price_asc"
  | "price_desc"
  | "rating_desc";

export interface SearchFilters {
  destinationCityId?: string;
  originCityId?: string;
  tripTypes: TripType[];
  airlineId?: string;
  routeType?: RouteType;
  priceMin?: number;
  priceMax?: number;
  /** REQUIRED whenever a price bound is set — honesty rule (AD-11). */
  currency?: string;
  /** "Expiring soon" preset: valid_until ≤ 7 days (AD-11). */
  expiringSoonOnly?: boolean;
  sort: SortOption;
}

export const DEFAULT_FILTERS: SearchFilters = { tripTypes: [], sort: "relevance" };

type ParamsLike = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const TRIP_TYPE_SET = new Set<string>(TRIP_TYPES);
const ROUTE_SET = new Set<string>(["direct", "transit"]);
const SORT_SET = new Set<string>([
  "relevance",
  "newest",
  "price_asc",
  "price_desc",
  "rating_desc",
]);
/** Platform currency set (DATABASE_DESIGN §2.6 CHECK). */
export const CURRENCIES = ["SAR", "EGP", "AED", "USD", "EUR"] as const;

const UUID_RE = /^[0-9a-f-]{36}$/i;
/** City references may be a DB uuid OR a canonical slug (cities.slug §3.6) —
 *  slugs keep URLs readable/SEO-friendly; the query layer resolves slug→id. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,60}$/;

function isCityRef(v: string): boolean {
  return UUID_RE.test(v) || SLUG_RE.test(v);
}

export function parseFilters(params: ParamsLike): SearchFilters {
  const f: SearchFilters = { tripTypes: [], sort: "relevance" };

  const dest = first(params.dest);
  if (dest && isCityRef(dest)) f.destinationCityId = dest;

  const origin = first(params.origin);
  if (origin && isCityRef(origin)) f.originCityId = origin;

  const rawTypes = first(params.type);
  if (rawTypes) {
    f.tripTypes = rawTypes
      .split(",")
      .map((t) => t.trim())
      .filter((t): t is TripType => TRIP_TYPE_SET.has(t));
  }

  const airline = first(params.airline);
  if (airline && /^[0-9a-f-]{36}$/i.test(airline)) f.airlineId = airline;

  const rt = first(params.rt);
  if (rt && ROUTE_SET.has(rt)) f.routeType = rt as RouteType;

  const pmin = Number(first(params.pmin));
  if (Number.isFinite(pmin) && pmin >= 0) f.priceMin = pmin;
  const pmax = Number(first(params.pmax));
  if (Number.isFinite(pmax) && pmax > 0) f.priceMax = pmax;

  const cur = first(params.cur)?.toUpperCase();
  if (cur && (CURRENCIES as readonly string[]).includes(cur)) f.currency = cur;

  if (first(params.soon) === "1") f.expiringSoonOnly = true;

  const sort = first(params.sort);
  if (sort && SORT_SET.has(sort)) f.sort = sort as SortOption;

  // Honesty rule: price bounds without an explicit currency are dropped.
  if ((f.priceMin !== undefined || f.priceMax !== undefined) && !f.currency) {
    delete f.priceMin;
    delete f.priceMax;
  }
  return f;
}

/** Canonical, stable serialization (deterministic key order for SEO/caching). */
export function serializeFilters(f: SearchFilters): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("dest", f.destinationCityId);
  set("origin", f.originCityId);
  set("type", f.tripTypes.length ? f.tripTypes.join(",") : undefined);
  set("airline", f.airlineId);
  set("rt", f.routeType);
  set("pmin", f.priceMin !== undefined ? String(f.priceMin) : undefined);
  set("pmax", f.priceMax !== undefined ? String(f.priceMax) : undefined);
  set("cur", f.currency);
  set("soon", f.expiringSoonOnly ? "1" : undefined);
  set("sort", f.sort !== "relevance" ? f.sort : undefined);
  return p.toString();
}

export function filtersToQuery(f: SearchFilters): string {
  const qs = serializeFilters(f);
  return qs ? `?${qs}` : "";
}

export function countActiveFilters(f: SearchFilters): number {
  let n = f.tripTypes.length;
  if (f.destinationCityId) n++;
  if (f.originCityId) n++;
  if (f.airlineId) n++;
  if (f.routeType) n++;
  if (f.priceMin !== undefined || f.priceMax !== undefined) n++;
  if (f.expiringSoonOnly) n++;
  return n;
}

export function isEmptyFilters(f: SearchFilters): boolean {
  return countActiveFilters(f) === 0;
}

import type { SearchFilters } from "@/lib/search/params";
import { PAGE_SIZE } from "@/lib/search/sort";
import type { PublicOfferRow } from "./types";

type Row = PublicOfferRow;

interface Page {
  rows: Row[];
  /** null = total unknown (still loading count or source unavailable) */
  total: number | null;
}

function isUnavailable(e: unknown): boolean {
  return (
    e instanceof Error &&
    (e.name === "DataSourceUnavailableError" ||
      /supabase-env-missing|Missing NEXT_PUBLIC/i.test(e.message))
  );
}

/** Structural subset of the PostgREST filter chain (no `Function` type — lint-safe). */
interface PgFilterChain<B> {
  eq(column: string, value: unknown): B;
  in(column: string, values: readonly unknown[]): B;
  gte(column: string, value: unknown): B;
  lte(column: string, value: unknown): B;
}

function applyFilters<B extends PgFilterChain<B>>(q: B, f: SearchFilters): B {
  if (f.destinationCityId) q = q.eq("destination_city_id", f.destinationCityId);
  if (f.originCityId) q = q.eq("origin_city_id", f.originCityId);
  // city refs may be slugs — resolution lands in Phase C via search_places;
  // until then slug values simply match nothing (honest empty), never wrong rows.
  if (f.tripTypes.length) q = q.in("trip_type", f.tripTypes as unknown as string[]);
  if (f.airlineId && /^[0-9a-f-]{36}$/i.test(f.airlineId))
    q = q.eq("airline_id", f.airlineId);
  if (f.routeType) q = q.eq("route_type", f.routeType);
  if (f.currency) {
    q = q.eq("currency", f.currency);
    if (f.priceMin !== undefined) q = q.gte("price_amount", f.priceMin);
    if (f.priceMax !== undefined) q = q.lte("price_amount", f.priceMax);
  }
  if (f.expiringSoonOnly)
    q = q.lte("valid_until", new Date(Date.now() + 7 * 86_400_000).toISOString());
  return q;
}

const ORDER_MAP: Record<
  SearchFilters["sort"],
  { col: string; asc: boolean }
> = {
  relevance: { col: "published_at", asc: false },
  newest: { col: "published_at", asc: false },
  price_asc: { col: "price_amount", asc: true },
  price_desc: { col: "price_amount", asc: false },
  rating_desc: { col: "agent_avg_rating", asc: false },
};

/**
 * Browser-side paginated listing (anon client → RLS/view path).
 * Load-more ×12 (ratified d). UI-agnostic pagination contract.
 */
export async function listPublicOffersBrowser(
  filters: SearchFilters,
  page: number,
): Promise<Page> {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const order = ORDER_MAP[filters.sort];
    const from = (Math.max(1, page) - 1) * PAGE_SIZE;

    let q = supabase
      .from("public_offers")
      .select("*", { count: "exact" })
      .range(from, from + PAGE_SIZE - 1)
      .order(order.col, { ascending: order.asc, nullsFirst: false });

    q = applyFilters(q, filters);

    const { data, error, count } = await q;
    if (error) throw error;
    return { rows: (data ?? []) as Row[], total: count ?? null };
  } catch (e) {
    if (isUnavailable(e)) throw new (await import("./types")).DataSourceUnavailableError();
    throw e;
  }
}

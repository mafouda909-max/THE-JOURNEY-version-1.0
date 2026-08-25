/**
 * Pure sorting + pagination for offer rows (AD-11 sorting model).
 * Operates on the public_offers projection row shape — kept structural so the
 * query layer can map DB rows onto it without coupling UI to SQL.
 */

export interface OfferRowLike {
  id: string;
  price_amount: number | string;
  currency: string;
  published_at: string | null;
  valid_until: string;
  agent_avg_rating: number | null;
  agent_reviews_count: number | null;
}

import type { SortOption } from "./params";

export const PAGE_SIZE = 12; // ratified: load-more ×12

function toNum(v: number | string): number {
  return typeof v === "string" ? Number(v) : v;
}

export type SortComparator = (a: OfferRowLike, b: OfferRowLike) => number;

/** relevance ≡ newest among verified rows (view guarantees verified — AD-11). */
export const comparators: Record<SortOption, SortComparator> = {
  relevance: byNewest,
  newest: byNewest,
  rating_desc(a, b) {
    const r = (b.agent_avg_rating ?? 0) - (a.agent_avg_rating ?? 0);
    if (r !== 0) return r;
    return (
      (b.agent_reviews_count ?? 0) - (a.agent_reviews_count ?? 0) || byNewest(a, b)
    );
  },
  price_asc(a, b) {
    return toNum(a.price_amount) - toNum(b.price_amount) || byNewest(a, b);
  },
  price_desc(a, b) {
    return toNum(b.price_amount) - toNum(a.price_amount) || byNewest(a, b);
  },
};

function byNewest(a: OfferRowLike, b: OfferRowLike): number {
  const ta = a.published_at ? Date.parse(a.published_at) : 0;
  const tb = b.published_at ? Date.parse(b.published_at) : 0;
  return tb - ta;
}

/**
 * Client-side sort of an already-fetched page set. The primary sort happens in
 * SQL; this exists for local re-sorting within loaded pages and for tests.
 */
export function sortRows<T extends OfferRowLike>(
  rows: T[],
  sort: SortOption,
): T[] {
  return [...rows].sort(comparators[sort]);
}

/** Offset pagination math (load-more ×12). Swap-friendly: UI never hardcodes. */
export function offsetForPage(page: number): number {
  return Math.max(0, page - 1) * PAGE_SIZE;
}

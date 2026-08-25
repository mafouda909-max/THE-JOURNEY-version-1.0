import { describe, expect, it } from "vitest";
import { offsetForPage, PAGE_SIZE, sortRows, type OfferRowLike } from "./sort";

function row(over: Partial<OfferRowLike>): OfferRowLike {
  return {
    id: Math.random().toString(),
    price_amount: 1000,
    currency: "EGP",
    published_at: "2026-08-01T00:00:00Z",
    valid_until: "2026-11-01T00:00:00Z",
    agent_avg_rating: 4,
    agent_reviews_count: 10,
    ...over,
  };
}

describe("sortRows (AD-11 sorting model)", () => {
  const a = row({ id: "a", price_amount: 900, published_at: "2026-08-01", agent_avg_rating: 4.5 });
  const b = row({ id: "b", price_amount: 1500, published_at: "2026-08-10", agent_avg_rating: 4.9 });
  const c = row({ id: "c", price_amount: 1200, published_at: "2026-08-05", agent_avg_rating: 4.1 });

  it("relevance ≡ newest-first among verified rows", () => {
    expect(sortRows([a, b, c], "relevance").map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(sortRows([a, b, c], "newest").map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("price sorts numeric with newest tiebreak", () => {
    expect(sortRows([b, c, a], "price_asc").map((r) => r.id)).toEqual(["a", "c", "b"]);
    expect(sortRows([a, c, b], "price_desc").map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("rating sorts desc with reviews-count then newest tiebreak", () => {
    const d = row({ id: "d", agent_avg_rating: 4.9, agent_reviews_count: 50, published_at: "2026-07-01" });
    expect(sortRows([a, b, c, d], "rating_desc")[0].id).toBe("d");
  });

  it("does not mutate input", () => {
    const input = [b, a];
    sortRows(input, "price_asc");
    expect(input.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("pagination math (ratified load-more ×12)", () => {
  it("PAGE_SIZE is 12 and offsets are zero-based", () => {
    expect(PAGE_SIZE).toBe(12);
    expect(offsetForPage(1)).toBe(0);
    expect(offsetForPage(2)).toBe(12);
    expect(offsetForPage(0)).toBe(0); // clamped
  });
});

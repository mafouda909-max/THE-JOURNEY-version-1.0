import { describe, expect, it } from "vitest";
import {
  countActiveFilters,
  DEFAULT_FILTERS,
  isEmptyFilters,
  parseFilters,
  serializeFilters,
} from "./params";

const UUID = "11111111-2222-3333-4444-555555555555";
const UUID2 = "aaaaaaaa-bbbb-cccc-dddd-eeeeffff0000";

describe("parseFilters", () => {
  it("returns defaults for empty params", () => {
    expect(parseFilters({})).toEqual(DEFAULT_FILTERS);
  });

  it("parses a full query", () => {
    const f = parseFilters({
      dest: UUID,
      origin: UUID2,
      type: "flight,umrah,bogus",
      airline: UUID,
      rt: "direct",
      pmin: "1000",
      pmax: "5000",
      cur: "egp",
      soon: "1",
      sort: "price_asc",
    });
    expect(f.destinationCityId).toBe(UUID);
    expect(f.originCityId).toBe(UUID2);
    expect(f.tripTypes).toEqual(["flight", "umrah"]); // bogus dropped
    expect(f.airlineId).toBe(UUID);
    expect(f.routeType).toBe("direct");
    expect(f.priceMin).toBe(1000);
    expect(f.priceMax).toBe(5000);
    expect(f.currency).toBe("EGP");
    expect(f.expiringSoonOnly).toBe(true);
    expect(f.sort).toBe("price_asc");
  });

  it("accepts canonical city slugs as well as uuids (§3.6)", () => {
    const f = parseFilters({ dest: "cairo", origin: "istanbul" });
    expect(f.destinationCityId).toBe("cairo");
    expect(f.originCityId).toBe("istanbul");
    const bad = parseFilters({ dest: "Cairo!", origin: "-nope" });
    expect(bad.destinationCityId).toBeUndefined();
    expect(bad.originCityId).toBeUndefined();
  });

  it("rejects values that are neither uuids nor canonical slugs", () => {
    const f = parseFilters({
      dest: "not a uuid!",
      rt: "teleport",
      sort: "chaos",
      type: "warp",
    });
    expect(f.destinationCityId).toBeUndefined();
    expect(f.routeType).toBeUndefined();
    expect(f.sort).toBe("relevance");
    expect(f.tripTypes).toEqual([]);
  });

  it("honesty rule: price bounds without currency are DROPPED (AD-11)", () => {
    const f = parseFilters({ pmin: "100", pmax: "900" });
    expect(f.priceMin).toBeUndefined();
    expect(f.priceMax).toBeUndefined();
    expect(f.currency).toBeUndefined();
    // and kept when currency present
    const g = parseFilters({ pmin: "100", pmax: "900", cur: "SAR" });
    expect(g.priceMin).toBe(100);
    expect(g.priceMax).toBe(900);
    expect(g.currency).toBe("SAR");
  });
});

describe("serializeFilters — canonical round-trip", () => {
  it("omits default/empty values (sort=relevance never serialized)", () => {
    expect(serializeFilters(DEFAULT_FILTERS)).toBe("");
  });

  it("round-trips through parse", () => {
    const original = parseFilters({
      dest: UUID,
      type: "hotel,cruise",
      cur: "AED",
      pmax: "700",
      soon: "1",
      sort: "rating_desc",
    });
    const qs = serializeFilters(original);
    expect(parseFilters(Object.fromEntries(new URLSearchParams(qs)))).toEqual(original);
  });

  it("produces deterministic key order", () => {
    const qs1 = serializeFilters(parseFilters({ sort: "newest", cur: "USD", pmin: "5" }));
    const qs2 = serializeFilters(parseFilters({ pmin: "5", cur: "USD", sort: "newest" }));
    expect(qs1).toBe(qs2);
  });
});

describe("active-filter accounting", () => {
  it("counts chips correctly", () => {
    const f = parseFilters({ dest: UUID, type: "flight,visa", rt: "transit" });
    expect(countActiveFilters(f)).toBe(4); // dest + flight + visa + route
    expect(isEmptyFilters(f)).toBe(false);
    expect(isEmptyFilters(DEFAULT_FILTERS)).toBe(true);
  });
});

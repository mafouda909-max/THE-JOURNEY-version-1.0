import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CURRENCIES,
  PRICE_TYPE_LABELS,
  TRIP_TYPES,
  TRIP_TYPE_KEYS,
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  formatPrice,
  formatRating,
  formatTravelers,
  formatAgo,
  groupThousands,
  isKnownTripType,
  localiseDigits,
  tripTypeKeyForFilter,
  tripTypeLabel,
} from "../src/lib/format";

describe("trip type tables", () => {
  it("exposes the six published categories in web order", () => {
    assert.deepEqual(TRIP_TYPE_KEYS, ["umrah", "package", "visa", "flight", "hotel", "cruise"]);
    assert.deepEqual(CURRENCIES, ["SAR", "AED", "USD", "EGP", "EUR"]);
  });

  it("labels known keys and passes unknown ones through", () => {
    assert.equal(tripTypeLabel("umrah"), "عمرة");
    assert.equal(tripTypeLabel("unknown_key"), "unknown_key");
    assert.equal(TRIP_TYPES[0]?.labelEn, "Umrah");
    assert.equal(PRICE_TYPE_LABELS.per_group, "للمجموعة");
  });

  it("narrows keys for filtering", () => {
    assert.equal(isKnownTripType("hotel"), true);
    assert.equal(isKnownTripType("all"), false);
    assert.equal(tripTypeKeyForFilter("all"), undefined);
    assert.equal(tripTypeKeyForFilter(null), undefined);
    assert.equal(tripTypeKeyForFilter("visa"), "visa");
  });
});

describe("digits", () => {
  it("groups thousands without padding zeros", () => {
    assert.equal(groupThousands("1950"), "1,950");
    assert.equal(groupThousands("999"), "999");
    assert.equal(groupThousands("0007"), "7");
    assert.equal(groupThousands("1000000"), "1,000,000");
  });

  it("renders Arabic-Indic digits by default and Latin on request", () => {
    assert.equal(localiseDigits("12 SAR"), "١٢ SAR");
    assert.equal(localiseDigits("12 SAR", { latin: true }), "12 SAR");
  });

  it("formats numbers, trims trailing zeros, and survives junk", () => {
    assert.equal(formatNumber(1950), "١,٩٥٠");
    assert.equal(formatNumber(-1500), "-١,٥٠٠");
    assert.equal(formatNumber(4.5, { decimals: 1 }), "٤.٥");
    assert.equal(formatNumber(4, { decimals: 2 }), "٤");
    assert.equal(formatNumber(Number.NaN), "٠");
    assert.equal(formatNumber(12.3456, { decimals: 9 }), "١٢.٣٤٥٦");
  });
});

describe("prices", () => {
  it("combines price type, amount and currency symbol", () => {
    assert.equal(formatPrice(1950, "SAR", "starting_from"), "يبدأ من ١,٩٥٠ ر.س");
    assert.equal(formatPrice(2500, "EGP", "per_person"), "للفرد ٢,٥٠٠ ج.م");
    assert.equal(formatPrice(300, "AED"), "٣٠٠ د.إ");
  });

  it("keeps unknown currencies readable", () => {
    assert.equal(formatPrice(10, "TRY"), "١٠ TRY");
  });
});

describe("dates", () => {
  it("formats a local date in Arabic", () => {
    const local = new Date(2027, 2, 12, 9, 30, 0, 0);
    assert.equal(formatDate(local.toISOString()), "١٢ مارس ٢٠٢٧");
    assert.equal(formatDateTime(local.toISOString()), "١٢ مارس ٢٠٢٧ · ٩:٣٠ ص");
  });

  it("uses the afternoon marker after noon", () => {
    const evening = new Date(2027, 11, 1, 21, 5, 0, 0);
    assert.equal(formatDateTime(evening.toISOString()), "١ ديسمبر ٢٠٢٧ · ٩:٠٥ م");
  });

  it("degrades gracefully on missing or invalid input", () => {
    assert.equal(formatDate(null), "—");
    assert.equal(formatDate("not-a-date"), "—");
    assert.equal(formatDateTime(undefined), "—");
  });
});

describe("measurements", () => {
  it("declines Arabic pluralisation rules for durations", () => {
    assert.equal(formatDuration(1), "يوم واحد");
    assert.equal(formatDuration(2), "يومان");
    assert.equal(formatDuration(5), "٥ أيام");
    assert.equal(formatDuration(15), "١٥ يوماً");
    assert.equal(formatDuration(null), "—");
    assert.equal(formatDuration(0), "—");
  });

  it("formats traveler counts", () => {
    assert.equal(formatTravelers(1), "مسافر واحد");
    assert.equal(formatTravelers(2), "مسافران");
    assert.equal(formatTravelers(9), "٩ مسافرين");
    assert.equal(formatTravelers(40), "٤٠ مسافراً");
    assert.equal(formatTravelers(0), "مسافر واحد");
  });

  it("clamps percentages to a sane range", () => {
    assert.equal(formatPercent(92.4), "٩٢٪");
    assert.equal(formatPercent(180), "١٠٠٪");
    assert.equal(formatPercent(-3), "٠٪");
  });

  it("shows a rating only when reviews exist", () => {
    assert.equal(formatRating(undefined, 0), "لا تقييمات بعد");
    assert.equal(formatRating(0, 5), "لا تقييمات بعد");
    assert.equal(formatRating(4.5, 3), "٤.٥ من ٥ (٣)");
  });

  it("describes freshness relative to a supplied clock", () => {
    const now = Date.UTC(2026, 8, 8, 12);
    assert.equal(formatAgo(null, now), "لم يُحدَّث بعد");
    assert.equal(formatAgo(now - 30_000, now), "الآن");
    assert.equal(formatAgo(now - 5 * 60_000, now), "قبل ٥ دقيقة");
    assert.equal(formatAgo(now - 3 * 3_600_000, now), "قبل ٣ ساعة");
    assert.equal(formatAgo(now + 60_000, now), "الآن");
    assert.equal(formatAgo(now - 2 * 86_400_000, now), "قبل ٢ يوم");
  });
});

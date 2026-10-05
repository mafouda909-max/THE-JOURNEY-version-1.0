import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatMoney,
  daysLeft,
  tripTypeLabel,
  TRIP_TYPES,
  PRICE_TYPE_LABELS,
  timeAgo,
  pexels,
} from "../src/lib/format";

test("formatMoney formats with thousands separators and currency", () => {
  assert.equal(formatMoney(1234, "SAR"), "1,234 SAR");
  assert.equal(formatMoney(9800, "SAR"), "9,800 SAR");
  assert.equal(formatMoney(100, "USD"), "100 USD");
});

test("daysLeft returns null for nullish and rounds up", () => {
  assert.equal(daysLeft(null), null);
  const future = new Date(Date.now() + 3 * 86_400_000);
  assert.equal(daysLeft(future), 3);
  const past = new Date(Date.now() - 86_400_000);
  assert.ok((daysLeft(past) ?? 0) <= 0);
});

test("TRIP_TYPES contains the canonical offer types", () => {
  const keys: string[] = TRIP_TYPES.map((t) => t.key);
  for (const k of ["umrah", "package", "visa", "flight", "hotel", "cruise"]) {
    assert.ok(keys.includes(k), `missing trip type ${k}`);
  }
});

test("tripTypeLabel returns label for known types and passthrough for unknown", () => {
  assert.equal(tripTypeLabel("umrah"), "عمرة");
  assert.equal(tripTypeLabel("package"), "باقات سياحية");
  assert.equal(tripTypeLabel("not-a-real-type"), "not-a-real-type");
});

test("PRICE_TYPE_LABELS covers all pricing bases", () => {
  assert.ok(PRICE_TYPE_LABELS.per_person === "للفرد");
  assert.ok(PRICE_TYPE_LABELS.per_group === "للمجموعة");
  assert.ok(PRICE_TYPE_LABELS.starting_from === "يبدأ من");
});

test("timeAgo returns Arabic relative wording", () => {
  assert.equal(timeAgo(new Date()), "الآن");
  const twoMin = new Date(Date.now() - 2 * 60_000);
  assert.match(timeAgo(twoMin), /قبل 2 دقيقة/);
});
test("a shared render clock stays stable when hydration crosses a minute boundary", (context) => {
  const createdAt = new Date("2026-10-05T12:00:00Z");
  const observedAt = createdAt.getTime() + 59_999;
  assert.equal(timeAgo(createdAt, observedAt), "الآن");
  context.mock.method(Date, "now", () => observedAt + 2);
  assert.equal(timeAgo(createdAt), "قبل 1 دقيقة");
  assert.equal(timeAgo(createdAt.toISOString(), observedAt), "الآن");
});
test("serialized audit timestamps render safely; invalid timestamps do not imply fresh activity", () => {
  const recent = new Date(Date.now() - 5 * 60_000);
  const old = new Date("2020-01-12T12:00:00Z");
  assert.equal(timeAgo(recent.toISOString()), timeAgo(recent));
  assert.equal(timeAgo(old.toISOString()), timeAgo(old));
  assert.equal(timeAgo("invalid timestamp"), "وقت غير متاح");
  assert.equal(timeAgo(new Date(NaN)), "وقت غير متاح");
});

test("pexels builds an image url with a crop", () => {
  const url = pexels(7984731, true);
  assert.ok(url.startsWith("https://images.pexels.com/photos/7984731/"));
  assert.ok(url.includes("h=1200&w=800"));
});

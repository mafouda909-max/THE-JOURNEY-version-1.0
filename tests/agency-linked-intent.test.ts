import assert from "node:assert/strict";
import test from "node:test";
import { buildMarketplaceInquiryIntent } from "../src/lib/agency-linked-intent";

const context = {
  originCity: "Cairo",
  destinationCity: "Istanbul",
  departureDate: "2026-12-10",
  durationDays: 5,
  tripType: "package",
  travelerCount: 4,
  travelDates: "Flexible by one day",
};

test("linked saved intent preserves multi-destination, budget, priorities and notes", () => {
  const result = buildMarketplaceInquiryIntent({
    originCity: "Cairo",
    destinations: ["Istanbul", "Bursa"],
    departureDate: "2026-12-12",
    returnDate: "2026-12-18",
    flexibilityDays: 2,
    travelers: { adults: 2, children: 1, infants: 1 },
    budgetAmountMinor: 250000,
    budgetCurrency: "EGP",
    budgetBasis: "total",
    tripType: "package",
    priorities: ["near public transport"],
    constraints: ["avoid overnight transfers"],
    notes: "Family-friendly room configuration required.",
    __silaReadiness: { privateMarker: "private" },
    nationality: "private-only",
  }, context);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value.destinations, ["Istanbul", "Bursa"]);
  assert.equal(result.value.departureDate, "2026-12-12");
  assert.equal(result.value.returnDate, "2026-12-18");
  assert.deepEqual(result.value.travelers, { adults: 2, children: 1, infants: 1 });
  assert.equal(result.value.budgetAmountMinor, 250000);
  assert.deepEqual(result.value.priorities, ["near public transport"]);
  assert.deepEqual(result.value.constraints, ["avoid overnight transfers"]);
  assert.equal(
    result.value.notes,
    "Family-friendly room configuration required. Request-specific dates: Flexible by one day",
  );
  assert.equal("nationality" in result.value, false);
  assert.equal("__silaReadiness" in result.value, false);
});

test("request traveler count takes precedence over older saved trip totals", () => {
  const result = buildMarketplaceInquiryIntent({
    originCity: "Cairo",
    destinations: ["Istanbul"],
    travelers: { adults: 2, children: 1, infants: 0 },
  }, { ...context, travelerCount: 2 });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value.travelers, { adults: 1, children: 1, infants: 0 });
});

test("unlinked inquiry remains compatible with the existing offer-to-agency flow", () => {
  const result = buildMarketplaceInquiryIntent(null, context);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.linkedSavedIntent, false);
  assert.equal(result.value.originCity, "Cairo");
  assert.deepEqual(result.value.destinations, ["Istanbul"]);
  assert.equal(result.value.departureDate, "2026-12-10");
  assert.equal(result.value.returnDate, "2026-12-14");
  assert.deepEqual(result.value.travelers, { adults: 4, children: 0, infants: 0 });
  assert.equal(result.value.tripType, "package");
  assert.equal(result.value.notes, "Flexible by one day");
});

test("a request smaller than its saved child/infant count fails closed", () => {
  const result = buildMarketplaceInquiryIntent({
    originCity: "Cairo",
    destinations: ["Istanbul"],
    travelers: { adults: 1, children: 2, infants: 0 },
  }, { ...context, travelerCount: 2 });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /must include the saved children\/infants/);
  }
});

test("malformed linked intent fails closed rather than silently dropping traveler requirements", () => {
  const result = buildMarketplaceInquiryIntent({
    destinations: [],
    travelers: { adults: -1, children: 0, infants: 0 },
  }, context);

  assert.equal(result.ok, false);
});

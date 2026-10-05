import assert from "node:assert/strict";
import test from "node:test";
import { groundSynthesis } from "../src/lib/ai-grounding";
import { normalizeAmadeusOffer } from "../src/lib/travel-suppliers/amadeus-normalize";
import { groundedVisaDecision } from "../src/lib/travel-visa-grounding";

const input = {
  originIata: "CAI",
  destinationIata: "IST",
  departureDate: "2026-11-01",
  returnDate: "2026-11-08",
  adults: 1,
  currency: "EGP",
};

function roundTripRaw(bags: Array<{ quantity?: number; weight?: number; weightUnit?: string }>) {
  return {
    id: "RT1",
    source: "GDS",
    price: { grandTotal: "15500.00", currency: "EGP" },
    itineraries: [
      {
        duration: "PT3H",
        segments: [
          {
            departure: { iataCode: "CAI", at: "2026-11-01T08:00:00" },
            arrival: { iataCode: "IST", at: "2026-11-01T11:00:00" },
            carrierCode: "TK",
            number: "691",
            duration: "PT3H",
          },
        ],
      },
      {
        duration: "PT3H30M",
        segments: [
          {
            departure: { iataCode: "IST", at: "2026-11-08T12:00:00" },
            arrival: { iataCode: "CAI", at: "2026-11-08T15:30:00" },
            carrierCode: "TK",
            number: "690",
            duration: "PT3H30M",
          },
        ],
      },
    ],
    travelerPricings: [
      {
        fareDetailsBySegment: bags.map((bag) => ({
          cabin: "ECONOMY",
          includedCheckedBags: bag,
        })),
      },
    ],
    validatingAirlineCodes: ["TK"],
  };
}

test("round-trip normalization keeps both journeys with the total round-trip price", () => {
  const normalized = normalizeAmadeusOffer(
    roundTripRaw([{ weight: 23, weightUnit: "KG" }, { weight: 23, weightUnit: "KG" }]),
    input,
    "2026-10-03T12:00:00.000Z",
  );

  assert.ok(normalized);
  assert.equal(normalized.price.total, 15500);
  assert.equal(normalized.segments.length, 2);
  assert.equal(normalized.segments[0]?.itineraryIndex, 0);
  assert.equal(normalized.segments[1]?.itineraryIndex, 1);
  assert.equal(normalized.durationMinutes, 390);
  assert.equal(normalized.stops, 0);
  assert.equal(normalized.includedCheckedBags?.weightKg, 23);
});

test("round-trip normalization rejects outbound-only supplier payloads", () => {
  const raw = roundTripRaw([{ quantity: 1 }, { quantity: 1 }]);
  raw.itineraries = raw.itineraries.slice(0, 1);

  assert.equal(
    normalizeAmadeusOffer(raw, input, "2026-10-03T12:00:00.000Z"),
    null,
  );
});

test("baggage is not presented as confirmed when segments disagree", () => {
  const normalized = normalizeAmadeusOffer(
    roundTripRaw([{ weight: 23, weightUnit: "KG" }, { weight: 20, weightUnit: "KG" }]),
    input,
    "2026-10-03T12:00:00.000Z",
  );

  assert.ok(normalized);
  assert.equal(normalized.includedCheckedBags, undefined);
  assert.ok(normalized.warnings.some((warning) => warning.includes("الأمتعة")));
});

test("visa decisions require fresh structured authoritative evidence", () => {
  assert.equal(
    groundedVisaDecision({
      visaRequired: true,
      sourceType: "VERIFIED",
      freshnessStatus: "FRESH",
    }),
    null,
  );

  assert.equal(
    groundedVisaDecision({
      visaRequired: false,
      sourceType: "VERIFIED",
      freshnessStatus: "FRESH",
      decisionBasis: "structured_authoritative",
      checkedAt: "2026-10-05T12:00:00.000Z",
      sourceUrl: "https://official.example/qa-rule",
      scope: { travelDocument: "passport", purpose: "any", travelDates: "any" },
      query: { travelDocument: "passport" },
      now: Date.parse("2026-10-05T12:30:00.000Z"),
    }),
    false,
  );

  assert.equal(
    groundedVisaDecision({
      visaRequired: true,
      sourceType: "AI_INFERRED",
      freshnessStatus: "FRESH",
      decisionBasis: "structured_authoritative",
    }),
    null,
  );
});

test("AI synthesis confidence is derived from citations to supplied URLs only", () => {
  const context = [
    "URL: https://official.example/rules",
    "URL: https://airline.example/transit",
  ].join("\n");

  const grounded = groundSynthesis({
    answer:
      "قاعدة أولى (https://official.example/rules) وقاعدة ثانية (https://airline.example/transit).",
    untrustedWebContext: context,
  });
  assert.equal(grounded.confidence, "MEDIUM");
  assert.deepEqual(grounded.sourcesUsed, [
    "https://official.example/rules",
    "https://airline.example/transit",
  ]);

  const invented = groundSynthesis({
    answer: "قاعدة غير مثبتة https://invented.example/rule",
    untrustedWebContext: context,
  });
  assert.equal(invented.confidence, "LOW");
  assert.deepEqual(invented.sourcesUsed, []);
});

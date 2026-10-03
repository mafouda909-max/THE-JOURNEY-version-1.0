import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { compareFlightOffers } from "../src/lib/travel-comparison";
import type { CanonicalFlightOffer } from "../src/lib/travel-suppliers/types";

function offer(
  id: string,
  total: number,
  durationMinutes: number,
  stops: number,
  currency = "EGP",
): CanonicalFlightOffer {
  return {
    id,
    source: {
      provider: "Test Supplier",
      kind: "GDS",
      authorityLevel: 4,
      checkedAt: "2026-10-03T10:00:00.000Z",
    },
    originIata: "CAI",
    destinationIata: "IST",
    departureDate: "2026-11-01",
    price: { total, currency },
    travelerCount: 1,
    durationMinutes,
    stops,
    validatingAirlines: ["TK"],
    cabin: "ECONOMY",
    fare: { refundable: null, changeable: null },
    segments: [
      {
        departureIata: "CAI",
        arrivalIata: "IST",
        departureAt: "2026-11-01T08:00:00",
        arrivalAt: "2026-11-01T11:00:00",
        carrierCode: "TK",
        flightNumber: id,
      },
    ],
    freshnessMinutes: 0,
    warnings: [],
  };
}

test("comparison labels cheapest, shortest and direct without hiding source", () => {
  const rows = compareFlightOffers([
    offer("A", 12000, 180, 0),
    offer("B", 10000, 240, 1),
    offer("C", 14000, 160, 0),
  ]);

  assert.equal(rows[0]?.offer.id, "B");
  assert.ok(rows.find((row) => row.offer.id === "B")?.badges.includes("أقل سعر في النتائج الحالية"));
  assert.ok(rows.find((row) => row.offer.id === "C")?.badges.includes("أقصر مدة"));
  assert.ok(rows.find((row) => row.offer.id === "A")?.badges.includes("مباشر"));
  assert.match(rows[0]?.facts.source ?? "", /Test Supplier/);
});

test("comparison does not label cheapest across different currencies", () => {
  const rows = compareFlightOffers([
    offer("EGP", 9000, 180, 0, "EGP"),
    offer("USD", 300, 170, 0, "USD"),
  ]);

  assert.equal(
    rows.some((row) => row.badges.includes("أقل سعر في النتائج الحالية")),
    false,
  );
});


test("readiness does not assert a universal passport-validity threshold", () => {
  const source = fs.readFileSync("src/lib/travel-readiness.ts", "utf8");
  assert.doesNotMatch(source, /معظم الوجهات|الحد الأدنى المقبول دولياً|أقل من 6 أشهر/);
  assert.match(source, /لا تفترض حدًا عالميًا ثابتًا/);
});

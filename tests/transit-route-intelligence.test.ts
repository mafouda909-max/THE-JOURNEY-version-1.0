import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assessTransitRoute,
  missingTransitRouteQuestions,
  transitRouteDecisionClaims,
} from "../src/lib/transit-route-intelligence";
import type { TravelReadinessInput } from "../src/lib/travel-readiness";
import { advisorFollowUpQuestions } from "../src/lib/readiness-advisor-policy";

function trip(answers: Record<string, string>): TravelReadinessInput {
  return {
    nationality: "مصري",
    destination: "إسبانيا",
    passportValidityMonths: 12,
    travelPurpose: "tourism",
    transitCountry: "إيطاليا",
    advisorAnswers: answers,
  };
}

const base = {
  tourism_accommodation: "مرنة",
  tourism_onward: "نعم",
  decision_transit_route: "CAI → FCO → MAD",
  decision_transit_layover_minutes: "180",
};

test("airport change is high operational complexity without claiming legal invalidity", () => {
  const result = assessTransitRoute(trip({
    ...base,
    decision_transit_connection: "airport_change",
    decision_transit_baggage: "through",
    decision_transit_airside: "unknown",
  }));
  assert.equal(result.status, "AVAILABLE");
  assert.equal(result.complexity, "HIGH");
  assert.match(result.summary, /تأكيد/);
  assert.ok(result.limitations.some((note) => /ليس ضمان/.test(note)));
});

test("baggage reclaim and landside each raise route complexity", () => {
  const baggage = assessTransitRoute(trip({
    ...base,
    decision_transit_connection: "same_terminal",
    decision_transit_baggage: "recheck",
    decision_transit_airside: "airside",
  }));
  assert.equal(baggage.complexity, "HIGH");

  const landside = assessTransitRoute(trip({
    ...base,
    decision_transit_connection: "same_terminal",
    decision_transit_baggage: "through",
    decision_transit_airside: "landside",
  }));
  assert.equal(landside.complexity, "HIGH");
});

test("terminal change is medium while same-terminal through-check airside is lower complexity", () => {
  const medium = assessTransitRoute(trip({
    ...base,
    decision_transit_connection: "terminal_change",
    decision_transit_baggage: "through",
    decision_transit_airside: "airside",
  }));
  assert.equal(medium.complexity, "MEDIUM");

  const low = assessTransitRoute(trip({
    ...base,
    decision_transit_connection: "same_terminal",
    decision_transit_baggage: "through",
    decision_transit_airside: "airside",
  }));
  assert.equal(low.complexity, "LOW");
  assert.match(low.summary, /لم تتحقق/);
});

test("layover duration is context only and never invents a universal MCT threshold", () => {
  const short = assessTransitRoute(trip({
    ...base,
    decision_transit_layover_minutes: "35",
    decision_transit_connection: "same_terminal",
    decision_transit_baggage: "through",
    decision_transit_airside: "airside",
  }));
  const long = assessTransitRoute(trip({
    ...base,
    decision_transit_layover_minutes: "600",
    decision_transit_connection: "same_terminal",
    decision_transit_baggage: "through",
    decision_transit_airside: "airside",
  }));
  assert.equal(short.complexity, "LOW");
  assert.equal(long.complexity, "LOW");
  assert.equal(short.layoverMinutes, 35);
  assert.ok(short.factors.find((factor) => factor.id === "layover")?.nextAction.includes("MCT"));
});

test("missing route details generate structured questions only for absent context", () => {
  const input = trip({
    tourism_accommodation: "مرنة",
    tourism_onward: "نعم",
    decision_transit_route: "CAI → FCO → MAD",
    decision_transit_connection: "same_terminal",
  });
  assert.deepEqual(
    missingTransitRouteQuestions(input).map((question) => question.id),
    [
      "decision_transit_baggage",
      "decision_transit_airside",
      "decision_transit_layover_minutes",
    ],
  );
});

test("route claims remain traveler-reported and unconfirmed", () => {
  const input = trip({
    ...base,
    decision_transit_connection: "same_terminal",
    decision_transit_baggage: "through",
    decision_transit_airside: "airside",
  });
  const assessment = assessTransitRoute(input);
  const claims = transitRouteDecisionClaims(input, assessment);
  assert.equal(claims.length, 1);
  assert.equal(claims[0]?.topic, "transit_route");
  assert.equal(claims[0]?.sourceType, "TRAVELER_REPORTED");
  assert.equal(claims[0]?.evidenceStatus, "REPORTED");
  assert.equal(claims[0]?.authorityLevel, 2);
  assert.equal(claims[0]?.polarity, "NEUTRAL");
});


test("transit purpose asks for the transit country when it is missing", () => {
  const withoutCountry: TravelReadinessInput = {
    nationality: "مصري",
    destination: "إسبانيا",
    passportValidityMonths: 12,
    travelPurpose: "transit",
  };
  assert.deepEqual(
    advisorFollowUpQuestions(withoutCountry).map((question) => question.id),
    ["transit_country", "decision_transit_route"],
  );

  assert.deepEqual(
    advisorFollowUpQuestions({ ...withoutCountry, transitCountry: "إيطاليا" }).map((question) => question.id),
    ["decision_transit_route"],
  );
});

test("unknown layover timing is preserved as unknown instead of inventing minutes", () => {
  const input = trip({
    ...base,
    decision_transit_layover_minutes: "غير متأكد",
    decision_transit_connection: "same_terminal",
    decision_transit_baggage: "through",
    decision_transit_airside: "airside",
  });
  assert.deepEqual(missingTransitRouteQuestions(input), []);
  const result = assessTransitRoute(input);
  assert.equal(result.status, "AVAILABLE");
  assert.equal(result.layoverMinutes, null);
  assert.equal(result.complexity, "LOW");
  assert.equal(result.factors.find((factor) => factor.id === "layover")?.state, "UNKNOWN");
});

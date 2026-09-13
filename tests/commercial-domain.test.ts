import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMarketplaceProjection,
  calculateQuoteEconomics,
  deriveCommercialSignals,
  nextStageForActivity,
  parseQuoteLines,
  parseTravelerIntent,
  quoteVersionDigest,
} from "../src/lib/commercial-domain";

const intentInput = {
  originCity: "Cairo",
  destinations: ["Istanbul"],
  departureDate: "2026-10-10",
  returnDate: "2026-10-15",
  flexibilityDays: 2,
  travelers: { adults: 2, children: 1, infants: 0 },
  budgetAmountMinor: 210000,
  budgetCurrency: "USD",
  budgetBasis: "total",
  tripType: "city_break",
  priorities: ["central hotel", "direct flight"],
  constraints: ["no red-eye flights"],
  notes: "Anniversary trip",
};

const linesInput = [
  {
    kind: "flight",
    label: "Round-trip flights",
    quantity: 3,
    currency: "USD",
    costUnitMinor: 42000,
    sellUnitMinor: 47000,
    commissionExpectedMinor: 0,
    supplierOptionId: 11,
    provenance: {
      sourceType: "booking_engine",
      sourceRef: "search-abc",
      observedAt: "2026-09-11T18:00:00.000Z",
      validUntil: "2026-09-12T18:00:00.000Z",
    },
  },
  {
    kind: "hotel",
    label: "5 nights hotel",
    quantity: 1,
    currency: "USD",
    costUnitMinor: 50000,
    sellUnitMinor: 62000,
    commissionExpectedMinor: 7000,
    supplierOptionId: 12,
    provenance: {
      sourceType: "supplier_quote",
      sourceRef: "hotel-email-42",
      observedAt: "2026-09-11T18:05:00.000Z",
      validUntil: "2026-09-13T18:00:00.000Z",
    },
  },
] as const;

test("traveler intent is structured, strict, and version-ready", () => {
  const parsed = parseTravelerIntent(intentInput);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.value.destinations, ["Istanbul"]);
  assert.equal(parsed.value.travelers.adults, 2);
  assert.equal(parsed.value.budgetCurrency, "USD");

  assert.equal(parseTravelerIntent({ ...intentInput, travelerEmail: "private@example.com" }).ok, false);
  assert.equal(parseTravelerIntent({ ...intentInput, returnDate: "2026-10-01" }).ok, false);
  assert.equal(parseTravelerIntent({ ...intentInput, destinations: [] }).ok, false);
});

test("quote economics are explicit and include expected commission", () => {
  const parsed = parseQuoteLines(linesInput);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const economics = calculateQuoteEconomics(parsed.value);
  assert.equal(economics.currency, "USD");
  assert.equal(economics.costTotalMinor, 176000);
  assert.equal(economics.sellTotalMinor, 203000);
  assert.equal(economics.commissionExpectedMinor, 7000);
  assert.equal(economics.grossProfitMinor, 34000);
  assert.equal(economics.marginBps, 1675);
  assert.equal(economics.markupBps, 1534);
});

test("quote versions reject mixed currencies and weak provenance", () => {
  assert.equal(parseQuoteLines([{ ...linesInput[0], currency: "EUR" }, linesInput[1]]).ok, false);
  assert.equal(parseQuoteLines([{ ...linesInput[0], provenance: { ...linesInput[0].provenance, observedAt: "bad" } }]).ok, false);
});

test("quote digest is deterministic and changes with commercial truth", () => {
  const parsed = parseQuoteLines(linesInput);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const economics = calculateQuoteEconomics(parsed.value);
  const base = {
    quoteId: 5,
    version: 1,
    intentRevision: 2,
    lines: parsed.value,
    economics,
    clientFacingTerms: "Deposit due within 24h",
    validUntil: "2026-09-13T18:00:00.000Z",
  };
  const digestA = quoteVersionDigest(base);
  const digestB = quoteVersionDigest({ ...base });
  assert.equal(digestA, digestB);
  assert.equal(digestA.length, 64);

  const changed = quoteVersionDigest({
    ...base,
    economics: { ...economics, sellTotalMinor: economics.sellTotalMinor + 1 },
  });
  assert.notEqual(changed, digestA);
});

test("commercial lifecycle cannot reopen terminal outcomes", () => {
  assert.equal(nextStageForActivity("new", "quote_sent"), "quoted");
  assert.equal(nextStageForActivity("quoted", "follow_up"), "negotiating");
  assert.equal(nextStageForActivity("negotiating", "outcome_won"), "won");
  assert.equal(nextStageForActivity("won", "follow_up"), "won");
  assert.equal(nextStageForActivity("lost", "quote_sent"), "lost");
});

test("intelligence loop returns operational signals rather than opaque AI prose", () => {
  const parsed = parseQuoteLines(linesInput);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const economics = calculateQuoteEconomics(parsed.value);
  const signals = deriveCommercialSignals({
    stage: "quoted",
    economics,
    lastActivityAt: "2026-09-05T10:00:00.000Z",
    quoteValidUntil: "2026-09-12T08:00:00.000Z",
    now: "2026-09-11T22:00:00.000Z",
  });
  assert.ok(signals.some((signal) => signal.kind === "follow_up_due"));
  assert.ok(signals.some((signal) => signal.kind === "quote_expiring"));
  assert.ok(signals.some((signal) => signal.kind === "healthy_margin"));
});

test("marketplace is a privacy-safe projection, not the commercial source of truth", () => {
  const parsedIntent = parseTravelerIntent(intentInput);
  const parsedLines = parseQuoteLines(linesInput);
  assert.equal(parsedIntent.ok, true);
  assert.equal(parsedLines.ok, true);
  if (!parsedIntent.ok || !parsedLines.ok) return;
  const economics = calculateQuoteEconomics(parsedLines.value);

  assert.equal(buildMarketplaceProjection({
    consent: false,
    intent: parsedIntent.value,
    economics,
    lines: parsedLines.value,
    title: "Istanbul city break",
    description: "Five-night Istanbul package with flights and centrally located accommodation.",
    destinationCountry: "Türkiye",
    heroImage: "https://example.invalid/istanbul.jpg",
  }).ok, false);

  const projection = buildMarketplaceProjection({
    consent: true,
    intent: parsedIntent.value,
    economics,
    lines: parsedLines.value,
    title: "Istanbul city break",
    description: "Five-night Istanbul package with flights and centrally located accommodation.",
    destinationCountry: "Türkiye",
    heroImage: "https://example.invalid/istanbul.jpg",
  });
  assert.equal(projection.ok, true);
  if (!projection.ok) return;
  assert.equal(projection.value.priceType, "per_person");
  assert.equal(projection.value.minTravelers, 3);
  assert.equal(JSON.stringify(projection.value).includes("Anniversary"), false);
  assert.equal(JSON.stringify(projection.value).includes("private@example.com"), false);
});

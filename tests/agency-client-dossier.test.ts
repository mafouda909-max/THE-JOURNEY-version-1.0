import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveAgencyClientDossier } from "../src/lib/agency-client-dossier";
import type { TravelerIntent } from "../src/lib/commercial-domain";

const intent: TravelerIntent = {
  originCity: "القاهرة",
  destinations: ["إسطنبول"],
  departureDate: "2026-12-15",
  returnDate: "2026-12-22",
  flexibilityDays: 0,
  travelers: { adults: 2, children: 1, infants: 0 },
  budgetAmountMinor: 1500000,
  budgetCurrency: "EGP",
  budgetBasis: "total",
  tripType: "custom",
  priorities: ["مواعيد مناسبة"],
  constraints: ["بدون ترانزيت طويل"],
  notes: "عميل خارج المنصة",
};

const now = new Date("2026-10-06T00:00:00.000Z");

test("client dossier never infers Advisor identity or legal travel context", () => {
  const dossier = deriveAgencyClientDossier({
    intent,
    supplierOptions: [],
    quoteVersions: [],
    now,
  });
  assert.equal(dossier.advisorContext.status, "NEEDS_CLIENT_CONTEXT");
  assert.deepEqual(
    dossier.advisorContext.missing.map((item) => item.id),
    ["nationality", "passport", "travel_purpose", "transit"],
  );
  assert.equal(dossier.trip.travelerCount, 3);
  assert.deepEqual(dossier.trip.budget, {
    amountMinor: 1500000,
    currency: "EGP",
    basis: "total",
  });
  assert.ok(dossier.advisorContext.limitations.some((text) => /لا تستنتج/.test(text)));
});

test("no supplier evidence means sourcing is still required", () => {
  const dossier = deriveAgencyClientDossier({
    intent,
    supplierOptions: [],
    quoteVersions: [],
    now,
  });
  assert.equal(dossier.commercialReadiness, "NEEDS_SOURCING");
  assert.ok(dossier.blockers.some((text) => /Supplier Option/.test(text)));
});

test("usable supplier evidence without a quote is ready to quote", () => {
  const dossier = deriveAgencyClientDossier({
    intent,
    supplierOptions: [
      { status: "active", freshness: "fresh", sourceType: "supplier_quote" },
      { status: "active", freshness: "expiring", sourceType: "booking_engine" },
    ],
    quoteVersions: [],
    now,
  });
  assert.equal(dossier.commercialReadiness, "READY_TO_QUOTE");
  assert.equal(dossier.sourcing.usable, 2);
  assert.deepEqual(dossier.sourcing.sourceTypes.sort(), ["booking_engine", "supplier_quote"]);
  assert.ok(dossier.warnings.some((text) => /ينتهي خلال 24 ساعة/.test(text)));
});

test("all active supplier evidence stale requires refresh", () => {
  const dossier = deriveAgencyClientDossier({
    intent,
    supplierOptions: [
      { status: "active", freshness: "stale", sourceType: "supplier_quote" },
      { status: "selected", freshness: "stale", sourceType: "manual" },
    ],
    quoteVersions: [],
    now,
  });
  assert.equal(dossier.commercialReadiness, "NEEDS_REFRESH");
  assert.equal(dossier.sourcing.usable, 0);
  assert.ok(dossier.blockers.some((text) => /منتهية/.test(text)));
});

test("expiring or expired latest quote gets attention even when sourcing is usable", () => {
  const supplier = [{ status: "active", freshness: "fresh" as const, sourceType: "supplier_quote" }];

  const expiring = deriveAgencyClientDossier({
    intent,
    supplierOptions: supplier,
    quoteVersions: [{ status: "draft", validUntil: "2026-10-06T12:00:00.000Z" }],
    now,
  });
  assert.equal(expiring.commercialReadiness, "QUOTE_ATTENTION");
  assert.equal(expiring.quote.latestExpiringSoon, true);

  const expired = deriveAgencyClientDossier({
    intent,
    supplierOptions: supplier,
    quoteVersions: [{ status: "draft", validUntil: "2026-10-05T23:59:59.000Z" }],
    now,
  });
  assert.equal(expired.commercialReadiness, "QUOTE_ATTENTION");
  assert.equal(expired.quote.latestExpired, true);
});

test("current quote with usable evidence is active, not guaranteed available", () => {
  const dossier = deriveAgencyClientDossier({
    intent,
    supplierOptions: [{ status: "active", freshness: "fresh", sourceType: "booking_engine" }],
    quoteVersions: [{ status: "draft", validUntil: "2026-10-10T00:00:00.000Z" }],
    now,
  });
  assert.equal(dossier.commercialReadiness, "QUOTE_ACTIVE");
  assert.equal(dossier.blockers.length, 0);
  assert.ok(dossier.nextActions.some((text) => /تطابق أحدث Quote/.test(text)));
});

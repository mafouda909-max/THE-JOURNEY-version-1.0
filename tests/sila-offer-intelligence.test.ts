import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSilaAiRuntimeGate } from "../src/lib/sila-ai-runtime-gate";
import { reviewSilaOfferIntelligence } from "../src/lib/sila-offer-intelligence";

test("marks expired published offers as not displayable", () => {
  const result = reviewSilaOfferIntelligence(
    {
      title: "عرض تركيا عائلي شامل",
      description: "عرض سياحي عائلي إلى تركيا يتضمن إقامة وانتقالات وبرنامج واضح مع شروط معلنة للمسافرين.",
      status: "published",
      agentVerificationStatus: "verified",
      agentTrustCurrent: true,
      tripType: "package",
      originCity: "القاهرة",
      destinationCity: "إسطنبول",
      destinationCountry: "تركيا",
      priceAmount: 25000,
      currency: "EGP",
      priceType: "per_person",
      includes: ["إقامة", "انتقالات"],
      excludes: ["التأشيرة"],
      expiresAt: "2026-10-01T00:00:00.000Z",
      lastConfirmedAt: "2026-09-30T10:00:00.000Z",
      sourceEvidence: [
        { label: "تأكيد الوكيل", kind: "agent_statement", checkedAt: "2026-09-30T10:00:00.000Z" },
        { label: "مصدر السعر الداخلي", kind: "price", checkedAt: "2026-09-30T10:00:00.000Z" },
      ],
    },
    new Date("2026-10-06T10:00:00.000Z"),
  );

  assert.equal(result.decision, "EXPIRED");
  assert.equal(result.shouldDisplayPublicly, false);
  assert.ok(result.findings.some((finding) => finding.id === "offer-expired"));
});

test("requires confirmation when offer evidence is missing", () => {
  const result = reviewSilaOfferIntelligence(
    {
      title: "عرض إسبانيا سياحة عائلي",
      description: "عرض سياحي لإسبانيا مناسب للعائلات مع إقامة وبرنامج ومتابعة من الوكيل وتفاصيل مبدئية للرحلة.",
      status: "published",
      agentVerificationStatus: "verified",
      agentTrustCurrent: true,
      tripType: "package",
      originCity: "القاهرة",
      destinationCity: "مدريد",
      destinationCountry: "إسبانيا",
      priceAmount: 50000,
      currency: "EGP",
      priceType: "per_person",
      includes: ["إقامة"],
      excludes: ["رسوم التأشيرة"],
      expiresAt: "2026-11-01T00:00:00.000Z",
      sourceEvidence: [],
    },
    new Date("2026-10-06T10:00:00.000Z"),
  );

  assert.equal(result.decision, "NEEDS_CONFIRMATION");
  assert.equal(result.shouldDisplayPublicly, false);
  assert.ok(result.findings.some((finding) => finding.id === "missing-agent-confirmation"));
  assert.ok(result.findings.some((finding) => finding.id === "missing-price-source"));
});

test("allows publishable offers only with active trust and fresh evidence", () => {
  const result = reviewSilaOfferIntelligence(
    {
      title: "عرض عمرة اقتصادي من القاهرة",
      description: "عرض عمرة اقتصادي واضح التفاصيل يشمل الإقامة والانتقالات والمتابعة مع توضيح الاستثناءات وشروط الحجز.",
      status: "published",
      agentVerificationStatus: "verified",
      agentTrustCurrent: true,
      tripType: "umrah",
      originCity: "القاهرة",
      destinationCity: "مكة",
      destinationCountry: "السعودية",
      priceAmount: 32000,
      currency: "EGP",
      priceType: "per_person",
      includes: ["إقامة", "انتقالات"],
      excludes: ["رسوم شخصية"],
      expiresAt: "2026-11-01T00:00:00.000Z",
      lastConfirmedAt: "2026-10-06T08:00:00.000Z",
      sourceEvidence: [
        { label: "تأكيد الوكيل", kind: "agent_statement", checkedAt: "2026-10-06T08:00:00.000Z" },
        { label: "مصدر السعر", kind: "price", checkedAt: "2026-10-06T08:00:00.000Z" },
      ],
    },
    new Date("2026-10-06T10:00:00.000Z"),
  );

  assert.equal(result.decision, "PUBLISHABLE");
  assert.equal(result.shouldDisplayPublicly, true);
});

test("AI runtime gate refuses to pretend live AI exists without provider keys", () => {
  const result = resolveSilaAiRuntimeGate({});

  assert.equal(result.state, "NOT_CONFIGURED");
  assert.equal(result.canCallModel, false);
  assert.ok(result.missing.includes("AI provider API key"));
});

test("AI runtime gate enables model calls when a provider is configured", () => {
  const result = resolveSilaAiRuntimeGate({ openRouterApiKey: "test-key" });

  assert.equal(result.state, "ENABLED");
  assert.equal(result.provider, "openrouter");
  assert.equal(result.canCallModel, true);
});

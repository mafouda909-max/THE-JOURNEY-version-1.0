import assert from "node:assert/strict";
import { test } from "node:test";
import type { AdvisorDecisionDossier } from "../src/lib/readiness-decision-dossier";
import {
  reviewSilaDecisionEvidence,
  silaEvidenceSatisfiesResearchNeed,
} from "../src/lib/sila-evidence-bridge";

function dossier(
  resolution: "SUPPORTED" | "UNCONFIRMED" | "CONFLICTED",
): AdvisorDecisionDossier {
  const evidenceStatus =
    resolution === "SUPPORTED"
      ? "VERIFIED"
      : resolution === "CONFLICTED"
        ? "CONFLICTED"
        : "UNCONFIRMED";

  return {
    claims: [
      {
        id: "visa:1",
        topic: "entry_visa",
        topicLabel: "التأشيرة المسبقة",
        statement: "حكم التأشيرة ضمن نطاق الرحلة",
        polarity: "YES",
        sourceType: "SOURCE_REPORTED",
        sourceLabel: "Official source",
        sourceUrl: "https://official.example/visa",
        authorityLevel: resolution === "SUPPORTED" ? 5 : 4,
        evidenceStatus,
        scope: ["مصري", "تركيا", "سياحة"],
        scopeKey: "entry_visa::سياحة|تركيا|مصري",
        checkedAt: "2026-10-06T10:00:00.000Z",
        validUntil: "2026-12-31T23:59:59.000Z",
        limitations: [],
      },
    ],
    groups: [
      {
        key: "entry_visa::سياحة|تركيا|مصري",
        topic: "entry_visa",
        topicLabel: "التأشيرة المسبقة",
        resolution,
        claimIds: ["visa:1"],
        sourceCount: 1,
        reason: "test",
      },
    ],
    supported: resolution === "SUPPORTED" ? ["التأشيرة المسبقة"] : [],
    unresolved: resolution === "UNCONFIRMED" ? ["التأشيرة المسبقة"] : [],
    conflicts: resolution === "CONFLICTED" ? ["التأشيرة المسبقة"] : [],
    followUpQuestions: [],
    generatedAt: "2026-10-06T10:00:00.000Z",
  };
}

test("verified scoped evidence becomes decision-grade and satisfies the entry-rule need", () => {
  const review = reviewSilaDecisionEvidence(dossier("SUPPORTED"));

  assert.equal(review.status, "READY");
  assert.equal(review.canSupportDecision, true);
  assert.equal(review.decisionGradePacketCount, 1);
  assert.ok(review.supportedTopics.includes("entry_visa"));
  assert.equal(
    silaEvidenceSatisfiesResearchNeed(
      {
        id: "entry-rules",
        label: "تأكيد شروط الدخول",
        sourceClass: "official",
        reason: "test",
      },
      review,
    ),
    true,
  );
});

test("unconfirmed evidence stays partial and cannot satisfy a source-critical need", () => {
  const review = reviewSilaDecisionEvidence(dossier("UNCONFIRMED"));

  assert.equal(review.status, "PARTIAL");
  assert.equal(review.canSupportDecision, false);
  assert.ok(review.unresolvedTopics.includes("entry_visa"));
  assert.equal(
    silaEvidenceSatisfiesResearchNeed(
      {
        id: "entry-rules",
        label: "تأكيد شروط الدخول",
        sourceClass: "official",
        reason: "test",
      },
      review,
    ),
    false,
  );
});

test("conflicted evidence fails closed", () => {
  const review = reviewSilaDecisionEvidence(dossier("CONFLICTED"));

  assert.equal(review.status, "CONFLICTED");
  assert.equal(review.canSupportDecision, false);
  assert.ok(review.blockers.some((item) => item.includes("تعارض")));
});

test("research context alone is not promoted into travel decision evidence", () => {
  const review = reviewSilaDecisionEvidence({
    claims: [
      {
        id: "research:1",
        topic: "research_context",
        topicLabel: "البحث المباشر",
        statement: "Web context",
        polarity: "NEUTRAL",
        sourceType: "SOURCE_REPORTED",
        sourceLabel: "Web",
        sourceUrl: "https://example.com/context",
        authorityLevel: 3,
        evidenceStatus: "UNCONFIRMED",
        scope: ["live-search"],
        scopeKey: "research_context::live-search",
        checkedAt: "2026-10-06T10:00:00.000Z",
        validUntil: null,
        limitations: ["not decision grade"],
      },
    ],
    groups: [
      {
        key: "research_context::live-search",
        topic: "research_context",
        topicLabel: "البحث المباشر",
        resolution: "UNCONFIRMED",
        claimIds: ["research:1"],
        sourceCount: 1,
        reason: "context only",
      },
    ],
    supported: [],
    unresolved: ["البحث المباشر"],
    conflicts: [],
    followUpQuestions: [],
    generatedAt: "2026-10-06T10:00:00.000Z",
  });

  assert.equal(review.status, "NO_EVIDENCE");
  assert.equal(review.canSupportDecision, false);
});

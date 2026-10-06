import assert from "node:assert/strict";
import { test } from "node:test";
import { createSilaTravelCase } from "../src/lib/sila-advisor-travel-case";
import { planSilaMissionControl } from "../src/lib/sila-mission-control";

test("plans advisor and AI activation missions when runtime is not configured", () => {
  const travelCase = createSilaTravelCase(
    "أنا مصري وعايز أسافر تركيا سياحة في ديسمبر والميزانية محدودة",
    new Date("2026-10-06T10:00:00.000Z"),
  );

  const result = planSilaMissionControl({ travelCase }, new Date("2026-10-06T10:00:00.000Z"));

  assert.equal(result.aiRuntime.canCallModel, false);
  assert.ok(result.tasks.some((task) => task.kind === "ACTIVATE_AI_RUNTIME"));
  assert.ok(result.tasks.some((task) => task.kind === "ANSWER_TRAVELER"));
  assert.ok(result.tasks.some((task) => task.kind === "REQUEST_SOURCE"));
  assert.match(result.commandSummary, /مهمة/);
});

test("plans suspend mission for expired offers before recommending them", () => {
  const result = planSilaMissionControl(
    {
      offers: [
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
          includes: ["إقامة"],
          expiresAt: "2026-10-01T00:00:00.000Z",
          sourceEvidence: [
            { label: "تأكيد الوكيل", kind: "agent_statement", checkedAt: "2026-09-30T10:00:00.000Z" },
            { label: "مصدر السعر", kind: "price", checkedAt: "2026-09-30T10:00:00.000Z" },
          ],
        },
      ],
    },
    new Date("2026-10-06T10:00:00.000Z"),
  );

  assert.ok(result.offerReviews.some((review) => review.decision === "EXPIRED"));
  assert.ok(result.tasks.some((task) => task.kind === "SUSPEND_OFFER"));
});

test("plans reconfirmation mission for offers missing sources", () => {
  const result = planSilaMissionControl(
    {
      offers: [
        {
          title: "عرض إسبانيا عائلي سياحة",
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
          includes: ["إقامة"],
          expiresAt: "2026-11-01T00:00:00.000Z",
          sourceEvidence: [],
        },
      ],
    },
    new Date("2026-10-06T10:00:00.000Z"),
  );

  assert.ok(result.offerReviews.some((review) => review.decision === "NEEDS_CONFIRMATION"));
  assert.ok(result.tasks.some((task) => task.kind === "RECONFIRM_OFFER"));
});

import assert from "node:assert/strict";
import test from "node:test";
import { createSilaTravelCase } from "../src/lib/sila-advisor-travel-case";
import { runSilaClosedLoopIntelligence } from "../src/lib/sila-closed-loop-intelligence";

const NOW = new Date("2026-10-06T10:00:00.000Z");

test("Sila closed loop runs observe, reason, act, audit and learn phases", () => {
  const travelCase = createSilaTravelCase("أنا مصري وعايز تركيا سياحة في ديسمبر والميزانية محدودة", NOW);
  const closedLoop = runSilaClosedLoopIntelligence({ travelCase }, NOW);

  assert.equal(closedLoop.mode, "CLOSED_LOOP_INTELLIGENCE_V1");
  assert.deepEqual(
    ["OBSERVE", "REASON", "ACT", "AUDIT", "LEARN"].every((phase) => closedLoop.loop.some((record) => record.phase === phase)),
    true,
  );
  assert.ok(closedLoop.auditTrail.some((entry) => entry.includes("AUDIT:audit-final-gate")));
  assert.ok(closedLoop.learningPlan.some((item) => item.includes("ملف العميل")));
});

test("Sila closed loop converts unsafe offer state into human-owned checkpoints", () => {
  const closedLoop = runSilaClosedLoopIntelligence(
    {
      offers: [
        {
          title: "عرض تركيا منتهي",
          description: "عرض سياحي إلى تركيا يشمل فندق وتنقلات أساسية ويحتاج مراجعة صلاحية السعر والتوافر قبل الظهور.",
          status: "published",
          destinationCountry: "تركيا",
          tripType: "tourism",
          priceAmount: 10000,
          currency: "EGP",
          expiresAt: "2026-09-01",
          departureDate: "2026-09-10",
          agentVerificationStatus: "verified",
          agentTrustCurrent: true,
          lastConfirmedAt: "2026-08-15",
          sourceEvidence: [
            { label: "تأكيد وكيل قديم", kind: "agent_statement", checkedAt: "2026-08-15" },
          ],
          includes: ["فندق"],
          excludes: ["الطيران"],
        },
      ],
    },
    NOW,
  );

  assert.equal(closedLoop.os.finalGate.canRecommendOffer, false);
  assert.ok(closedLoop.loop.some((record) => record.decision === "REQUIRES_HUMAN"));
  assert.ok(closedLoop.checkpoints.some((checkpoint) => checkpoint.trigger === "agent_confirmation_due"));
  assert.ok(closedLoop.learningPlan.some((item) => item.includes("مراقبة العروض")));
});

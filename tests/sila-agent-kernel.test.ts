import assert from "node:assert/strict";
import test from "node:test";
import { createSilaTravelCase } from "../src/lib/sila-advisor-travel-case";
import { runSilaAgentKernel } from "../src/lib/sila-agent-kernel";

const NOW = new Date("2026-10-06T10:00:00.000Z");

test("Sila Agent Kernel plans tool use instead of behaving like a plain chatbot", () => {
  const travelCase = createSilaTravelCase(
    "أنا مصري وعايز أسافر تركيا سياحة في ديسمبر والميزانية محدودة، وعايز أعرف أبدأ منين.",
    NOW,
  );

  const kernel = runSilaAgentKernel({ travelCase }, NOW);

  assert.equal(kernel.mode, "AGENT_KERNEL_V1");
  assert.ok(kernel.executionOrder.includes("CUSTOMER_MEMORY_RECALL"));
  assert.ok(kernel.executionOrder.includes("OFFICIAL_WORLD_RESEARCH"));
  assert.ok(kernel.executionOrder.includes("ADVISOR_RESPONSE"));
  assert.ok(kernel.executionOrder.includes("QUALITY_REVIEW"));
  assert.ok(kernel.worldConnectionPolicy.requiredForExternalClaims.includes("مصدر رسمي أو مزود موثوق"));
  assert.ok(kernel.worldConnectionPolicy.forbidden.some((item) => item.includes("اختراع شروط فيزا")));
});

test("Sila Agent Kernel blocks world research when live AI/search runtime is not configured", () => {
  const travelCase = createSilaTravelCase("عميل مصري عايز تركيا سياحة في ديسمبر، أطلب منه إيه قبل العرض؟", NOW);
  const kernel = runSilaAgentKernel({ travelCase }, NOW);
  const worldResearch = kernel.toolPlan.find((plan) => plan.tool === "OFFICIAL_WORLD_RESEARCH");

  assert.equal(worldResearch?.status, "BLOCKED");
  assert.ok(worldResearch?.blockedBy.length);
  assert.ok(kernel.autonomyBoundaries.some((item) => item.includes("evidence packet")));
});

test("Sila Agent Kernel routes offer problems into review and monitoring tools", () => {
  const kernel = runSilaAgentKernel(
    {
      offers: [
        {
          title: "عرض تركيا منتهي",
          status: "published",
          destination: "تركيا",
          tripType: "tourism",
          price: 10000,
          currency: "EGP",
          expiresAt: "2026-09-01",
          departureDate: "2026-09-10",
          agentVerificationStatus: "VERIFIED",
          agentTrustCurrent: true,
          lastConfirmedAt: "2026-08-15",
          sourceEvidence: ["agent-confirmation"],
          includes: ["فندق"],
          excludes: ["الطيران"],
        },
      ],
    },
    NOW,
  );

  assert.ok(kernel.executionOrder.includes("OFFER_REVIEW"));
  assert.ok(kernel.executionOrder.includes("OFFER_MONITORING"));
  assert.ok(kernel.missionControl.tasks.some((task) => task.kind === "SUSPEND_OFFER"));
});

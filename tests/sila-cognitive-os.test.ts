import assert from "node:assert/strict";
import test from "node:test";
import { createSilaTravelCase } from "../src/lib/sila-advisor-travel-case";
import { runSilaCognitiveOs } from "../src/lib/sila-cognitive-os";

const NOW = new Date("2026-10-06T10:00:00.000Z");

test("SILA Cognitive OS adds trust ledger, watchers and self-evaluation above the agentic OS", () => {
  const travelCase = createSilaTravelCase(
    "أنا مصري وعايز أسافر تركيا سياحة في ديسمبر ومعايا أسرة وعايز عرض موثوق.",
    NOW,
  );

  const os = runSilaCognitiveOs({ travelCase }, NOW);

  assert.equal(os.mode, "COGNITIVE_TRAVEL_OS_V1");
  assert.ok(os.trustLedger.some((rule) => rule.id === "source-required" && rule.required));
  assert.ok(os.worldWatchers.some((watcher) => watcher.id === "visa-rules-watcher"));
  assert.ok(os.worldWatchers.some((watcher) => watcher.id === "offer-freshness-watcher"));
  assert.ok(os.cognitiveLoops.some((loop) => loop.signal === "SELF_EVALUATION"));
  assert.ok(os.releaseGate.blockedBy.some((item) => item.includes("World-connected research")));
});

test("SILA Cognitive OS keeps high-impact execution closed while allowing safe planning", () => {
  const travelCase = createSilaTravelCase("عميل عايز تركيا، اعمل brief للوكيل قبل ما أدي سعر.", NOW);
  const os = runSilaCognitiveOs({ travelCase }, NOW);

  assert.equal(os.releaseGate.canExecuteExternalAction, false);
  assert.ok(["L1_PLAN_AND_EXPLAIN", "L2_MONITOR_AND_DRAFT"].includes(os.autonomyLevel));
  assert.ok(os.cognitiveLoops.some((loop) => loop.id === "learn-from-feedback"));
});

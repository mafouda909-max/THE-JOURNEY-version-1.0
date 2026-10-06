import assert from "node:assert/strict";
import test from "node:test";
import { resolveSilaRuntimeStatus } from "../src/lib/sila-runtime-status";

test("Sila runtime status is logic-only and honest when no provider keys exist", () => {
  const status = resolveSilaRuntimeStatus({});

  assert.equal(status.service, "sila-runtime-status");
  assert.equal(status.aiRuntime.state, "NOT_CONFIGURED");
  assert.equal(status.canDraftWithAi, false);
  assert.equal(status.canUsePaidAi, false);
  assert.equal(status.canRunBackgroundCalls, false);
  assert.ok(status.capabilities.includes("LOGIC_ONLY"));
  assert.ok(status.capabilities.includes("WORLD_RESEARCH_REQUIRES_EVIDENCE"));
  assert.ok(status.missing.includes("AI provider API key"));
  assert.ok(!status.missing.includes("server-side advisor endpoint"));
  assert.equal(status.routing.totalAgents, 6);
  assert.equal(status.routing.readyAgents, 0);
});

test("Sila runtime status enables pilot drafts with Vercel AI Gateway without paid/background calls", () => {
  const status = resolveSilaRuntimeStatus({
    SILA_AI_TIER: "pilot",
    VERCEL_AI_GATEWAY_API_KEY: "configured",
  });

  assert.equal(status.aiRuntime.state, "ENABLED");
  assert.equal(status.aiRuntime.provider, "vercel_ai_gateway");
  assert.equal(status.costGuard.canUsePilotAi, true);
  assert.equal(status.canDraftWithAi, true);
  assert.equal(status.canUsePaidAi, false);
  assert.equal(status.canRunBackgroundCalls, false);
  assert.ok(status.capabilities.includes("PILOT_AI_DRAFTS"));
  assert.ok(status.guardrails.some((item) => item.includes("Pilot tier")));
  assert.ok(status.publicSummary.includes("Pilot"));
});

test("Sila runtime status blocks paid AI when paid calls are not explicitly allowed", () => {
  const status = resolveSilaRuntimeStatus({
    SILA_AI_TIER: "production",
    OPENAI_API_KEY: "configured",
  });

  assert.equal(status.aiRuntime.state, "ENABLED");
  assert.equal(status.aiRuntime.provider, "openai");
  assert.equal(status.canDraftWithAi, false);
  assert.equal(status.canUsePaidAi, false);
  assert.ok(status.blockers.some((item) => item.includes("التشغيل المدفوع مقفول")));
  assert.ok(status.missing.includes("SILA_AI_ALLOW_PAID_CALLS=true"));
});

test("Sila runtime status allows paid AI only with explicit approval, budget, and optional background flag", () => {
  const status = resolveSilaRuntimeStatus({
    SILA_AI_TIER: "production",
    OPENAI_API_KEY: "configured",
    SILA_AI_ALLOW_PAID_CALLS: "true",
    SILA_AI_ALLOW_BACKGROUND_CALLS: "true",
    SILA_AI_MONTHLY_BUDGET_USD: "5",
  });

  assert.equal(status.canDraftWithAi, true);
  assert.equal(status.canUsePaidAi, true);
  assert.equal(status.canRunBackgroundCalls, true);
  assert.ok(status.capabilities.includes("PAID_AI_ALLOWED"));
  assert.ok(status.capabilities.includes("BACKGROUND_CALLS_ALLOWED"));
  assert.equal(status.costGuard.budget.usd, 5);
});

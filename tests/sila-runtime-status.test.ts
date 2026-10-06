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


test("Sila runtime status recognizes enabled generic Vercel Gateway credentials", () => {
  const status = resolveSilaRuntimeStatus({
    SILA_AI_TIER: "pilot",
    AI_GATEWAY_API_KEY: "generic-gateway-12345",
    SILA_VERCEL_GATEWAY_ENABLED: "true",
  });

  assert.equal(status.aiRuntime.state, "ENABLED");
  assert.equal(status.aiRuntime.provider, "vercel_ai_gateway");
  assert.equal(status.canDraftWithAi, true);
  assert.ok(status.providers.some((provider) =>
    provider.provider === "vercel_ai_gateway" && provider.configured
  ));
});

test("Sila runtime status recognizes Vercel OIDC only behind the Gateway enable flag", () => {
  const status = resolveSilaRuntimeStatus({
    SILA_AI_TIER: "pilot",
    VERCEL_OIDC_TOKEN: "oidc-token-123456789",
    SILA_VERCEL_GATEWAY_ENABLED: "true",
  });

  assert.equal(status.aiRuntime.provider, "vercel_ai_gateway");
  assert.equal(status.canDraftWithAi, true);
});

test("Sila runtime status never claims Anthropic-only execution before its adapter exists", () => {
  const status = resolveSilaRuntimeStatus({
    SILA_AI_TIER: "production",
    ANTHROPIC_API_KEY: "anthropic-key-12345",
    SILA_AI_ALLOW_PAID_CALLS: "true",
    SILA_AI_MONTHLY_BUDGET_USD: "5",
  });

  assert.equal(status.aiRuntime.state, "NOT_CONFIGURED");
  assert.equal(status.aiRuntime.provider, null);
  assert.equal(status.canDraftWithAi, false);
  assert.ok(status.missing.some((item) => item.includes("Anthropic direct adapter")));
});


test("Sila runtime status exposes Gemini as a separate public-context worker", () => {
  const status = resolveSilaRuntimeStatus({
    GEMINI_API_KEY: "gemini-key-12345",
    SILA_GEMINI_CONTEXT_ENABLED: "true",
  });

  assert.equal(status.contextWorkers.gemini.state, "READY");
  assert.equal(status.contextWorkers.gemini.model, "gemini-3.8-flash");
  assert.equal(status.contextWorkers.gemini.allowsSensitiveData, false);
  assert.ok(status.capabilities.includes("GEMINI_PUBLIC_CONTEXT_READY"));
  assert.ok(status.guardrails.some((item) => item.includes("بيانات المسافر الحساسة")));
});

test("Gemini context readiness does not falsely activate the live advisor runtime", () => {
  const status = resolveSilaRuntimeStatus({
    GEMINI_API_KEY: "gemini-key-12345",
    SILA_GEMINI_CONTEXT_ENABLED: "true",
  });

  assert.equal(status.contextWorkers.gemini.state, "READY");
  assert.equal(status.aiRuntime.state, "NOT_CONFIGURED");
  assert.equal(status.canDraftWithAi, false);
});

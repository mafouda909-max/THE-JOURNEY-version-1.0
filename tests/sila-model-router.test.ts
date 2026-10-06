import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSilaAgentRoutingMatrix,
  routeSilaAgentModel,
  SILA_AGENT_REGISTRY,
  type SilaModelRouterEnv,
} from "../src/lib/sila-model-router";

const EMPTY_ENV: SilaModelRouterEnv = {};

test("Sila model router blocks agents when no provider is configured", () => {
  const decision = routeSilaAgentModel("RESEARCH_AGENT", EMPTY_ENV);

  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.selectedProvider, null);
  assert.ok(decision.missing.includes("OPENAI_API_KEY"));
  assert.ok(decision.guardrails.some((item) => item.includes("مفاتيح API")));
});

test("Sila model router selects the strongest configured provider per agent", () => {
  const decision = routeSilaAgentModel("QUALITY_GUARD", {
    OPENAI_API_KEY: "configured",
    OPENROUTER_API_KEY: "configured",
  });

  assert.equal(decision.status, "READY");
  assert.equal(decision.selectedProvider, "openai");
  assert.ok(decision.agent.requiredCapabilities.includes("risk_review"));
});

test("Sila model router can use OpenRouter as fallback without making it the core brain", () => {
  const decision = routeSilaAgentModel("TRAVELER_ADVISOR", {
    OPENROUTER_API_KEY: "configured",
  });

  assert.equal(decision.status, "FALLBACK_READY");
  assert.equal(decision.selectedProvider, "openrouter");
  assert.ok(decision.reason.includes("openrouter"));
});

test("Sila pilot tier only uses pilot-eligible providers and marks output as limited", () => {
  const decision = routeSilaAgentModel("TRAVELER_ADVISOR", {
    SILA_AI_TIER: "pilot",
    OPENAI_API_KEY: "configured",
    OPENROUTER_API_KEY: "configured",
  });

  assert.equal(decision.mode, "pilot");
  assert.equal(decision.status, "PILOT_READY");
  assert.equal(decision.selectedProvider, "openrouter");
  assert.ok(decision.pilotLimits.some((limit) => limit.includes("مسودات")));
  assert.ok(decision.guardrails.some((limit) => limit.includes("لا يعني جودة أقل")));
});

test("Sila legacy free alias resolves to pilot tier", () => {
  const decision = routeSilaAgentModel("TRAVELER_ADVISOR", {
    SILA_AI_MODE: "free",
    OPENROUTER_API_KEY: "configured",
  });

  assert.equal(decision.mode, "pilot");
  assert.equal(decision.status, "PILOT_READY");
});

test("Sila pilot tier blocks when only paid-first providers are configured", () => {
  const decision = routeSilaAgentModel("ORCHESTRATOR", {
    SILA_AI_TIER: "pilot",
    OPENAI_API_KEY: "configured",
  });

  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.selectedProvider, null);
  assert.ok(decision.missing.includes("OPENROUTER_API_KEY"));
  assert.ok(decision.missing.includes("VERCEL_AI_GATEWAY_API_KEY"));
});

test("Sila agent registry covers every cognitive travel OS role", () => {
  const roles = new Set(SILA_AGENT_REGISTRY.map((agent) => agent.role));

  assert.ok(roles.has("ORCHESTRATOR"));
  assert.ok(roles.has("RESEARCH_AGENT"));
  assert.ok(roles.has("OFFER_AUDITOR"));
  assert.ok(roles.has("TRAVELER_ADVISOR"));
  assert.ok(roles.has("AGENT_COPILOT"));
  assert.ok(roles.has("QUALITY_GUARD"));
});

test("Sila routing matrix exposes a decision for every registered agent", () => {
  const matrix = buildSilaAgentRoutingMatrix({ OPENAI_API_KEY: "configured" });

  assert.equal(matrix.length, SILA_AGENT_REGISTRY.length);
  assert.ok(matrix.every((decision) => decision.status === "READY"));
  assert.ok(matrix.every((decision) => decision.guardrails.length > 0));
});


test("Sila model router recognizes the real enabled Gateway credential path", () => {
  const decision = routeSilaAgentModel("TRAVELER_ADVISOR", {
    SILA_AI_TIER: "pilot",
    AI_GATEWAY_API_KEY: "generic-gateway-12345",
    SILA_VERCEL_GATEWAY_ENABLED: "true",
  });

  assert.equal(decision.status, "PILOT_READY");
  assert.equal(decision.selectedProvider, "vercel_ai_gateway");
});

test("Sila model router does not route to Anthropic until an executable adapter exists", () => {
  const decision = routeSilaAgentModel("QUALITY_GUARD", {
    SILA_AI_TIER: "production",
    ANTHROPIC_API_KEY: "anthropic-key-12345",
  });

  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.selectedProvider, null);
  assert.ok(decision.missing.some((item) => item.includes("Anthropic direct adapter")));
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSilaActivationManifest } from "../src/lib/sila-activation-manifest";
import { resolveSilaCostRuntimeGuard } from "../src/lib/sila-cost-runtime-guard";

test("activation manifest defaults to safe-off/blocked without leaking secrets", () => {
  const manifest = resolveSilaActivationManifest(
    {},
    new Date("2026-10-06T15:30:00.000Z"),
  );

  assert.equal(manifest.service, "sila-activation-manifest");
  assert.equal(manifest.secretsExposed, false);
  assert.equal(manifest.tracks.find((item) => item.id === "zero_cost_pilot")?.state, "BLOCKED");
  assert.equal(manifest.tracks.find((item) => item.id === "guarded_paid_ai")?.state, "SAFE_OFF");
  assert.equal(manifest.tracks.find((item) => item.id === "background_ai")?.state, "SAFE_OFF");
  assert.equal(manifest.tracks.find((item) => item.id === "traveler_workspace")?.state, "SAFE_OFF");
  assert.ok(manifest.exactEnvNames.includes("OPENROUTER_API_KEY"));
  assert.ok(manifest.exactEnvNames.includes("GEMINI_API_KEY"));
  assert.ok(manifest.exactEnvNames.includes("SILA_AI_ALLOW_PAID_CALLS"));
});

test("zero-cost pilot becomes active only with OpenRouter + pilot tier", () => {
  const manifest = resolveSilaActivationManifest({
    OPENROUTER_API_KEY: "openrouter-key-12345",
    SILA_AI_TIER: "pilot",
    SILA_AI_ALLOW_PAID_CALLS: "false",
    SILA_AI_ALLOW_BACKGROUND_CALLS: "false",
  });

  const pilot = manifest.tracks.find((item) => item.id === "zero_cost_pilot");
  assert.equal(pilot?.state, "ACTIVE");
  assert.equal(pilot?.costClass, "zero_cost_route");
  assert.equal(pilot?.blockers.length, 0);
});

test("Gemini context activation stays independent from live advisor runtime", () => {
  const manifest = resolveSilaActivationManifest({
    GEMINI_API_KEY: "gemini-key-12345",
    SILA_GEMINI_CONTEXT_ENABLED: "true",
  });

  const gemini = manifest.tracks.find((item) => item.id === "gemini_context");
  const pilot = manifest.tracks.find((item) => item.id === "zero_cost_pilot");

  assert.equal(gemini?.state, "ACTIVE");
  assert.notEqual(pilot?.state, "ACTIVE");
  assert.ok(gemini?.warnings.some((item) => item.includes("الحساسة")));
});

test("paid AI activates only with guarded tier, provider, explicit flag and positive budget", () => {
  const active = resolveSilaActivationManifest({
    SILA_AI_TIER: "production",
    OPENAI_API_KEY: "openai-key-12345",
    SILA_AI_ALLOW_PAID_CALLS: "true",
    SILA_AI_MONTHLY_BUDGET_USD: "5",
  });
  assert.equal(
    active.tracks.find((item) => item.id === "guarded_paid_ai")?.state,
    "ACTIVE",
  );

  const zeroBudget = resolveSilaActivationManifest({
    SILA_AI_TIER: "production",
    OPENAI_API_KEY: "openai-key-12345",
    SILA_AI_ALLOW_PAID_CALLS: "true",
    SILA_AI_MONTHLY_BUDGET_USD: "0",
  });
  assert.equal(
    zeroBudget.tracks.find((item) => item.id === "guarded_paid_ai")?.state,
    "BLOCKED",
  );
});

test("cost guard treats zero or negative budget as no paid budget", () => {
  const zero = resolveSilaCostRuntimeGuard({
    SILA_AI_TIER: "production",
    OPENAI_API_KEY: "openai-key-12345",
    SILA_AI_ALLOW_PAID_CALLS: "true",
    SILA_AI_MONTHLY_BUDGET_USD: "0",
  });
  assert.equal(zero.budget.usd, null);
  assert.equal(zero.canUsePaidAi, false);

  const negative = resolveSilaCostRuntimeGuard({
    SILA_AI_TIER: "production",
    OPENAI_API_KEY: "openai-key-12345",
    SILA_AI_ALLOW_PAID_CALLS: "true",
    SILA_AI_MONTHLY_BUDGET_USD: "-5",
  });
  assert.equal(negative.budget.usd, null);
  assert.equal(negative.canUsePaidAi, false);
});

test("manifest output never includes credential values", () => {
  const manifest = resolveSilaActivationManifest({
    OPENROUTER_API_KEY: "do-not-leak-openrouter",
    GEMINI_API_KEY: "do-not-leak-gemini",
    OPENAI_API_KEY: "do-not-leak-openai",
    SILA_AI_TIER: "pilot",
  });
  const serialized = JSON.stringify(manifest);

  assert.equal(serialized.includes("do-not-leak-openrouter"), false);
  assert.equal(serialized.includes("do-not-leak-gemini"), false);
  assert.equal(serialized.includes("do-not-leak-openai"), false);
});

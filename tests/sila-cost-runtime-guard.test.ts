import assert from "node:assert/strict";
import test from "node:test";
import { resolveSilaCostRuntimeGuard } from "../src/lib/sila-cost-runtime-guard";

test("Sila cost guard keeps the system deterministic when no provider key exists", () => {
  const guard = resolveSilaCostRuntimeGuard({});

  assert.equal(guard.tier, "pilot");
  assert.equal(guard.hasAnyProviderKey, false);
  assert.equal(guard.canUsePilotAi, false);
  assert.equal(guard.canUsePaidAi, false);
  assert.ok(guard.blockers.some((blocker) => blocker.includes("logic")));
});

test("Sila cost guard allows pilot AI only for draft-safe provider keys", () => {
  const guard = resolveSilaCostRuntimeGuard({
    SILA_AI_TIER: "pilot",
    OPENROUTER_API_KEY: "configured",
  });

  assert.equal(guard.canUsePilotAi, true);
  assert.equal(guard.canUsePaidAi, false);
  assert.equal(guard.canRunAutomatically, false);
  assert.ok(guard.guardrails.some((item) => item.includes("Pilot tier")));
});

test("Sila cost guard does not spend with paid keys unless explicitly enabled", () => {
  const guard = resolveSilaCostRuntimeGuard({
    SILA_AI_TIER: "production",
    OPENAI_API_KEY: "configured",
  });

  assert.equal(guard.hasPaidProviderKey, true);
  assert.equal(guard.paidCallsAllowed, false);
  assert.equal(guard.canUsePaidAi, false);
  assert.ok(guard.missing.includes("SILA_AI_ALLOW_PAID_CALLS=true"));
});

test("Sila cost guard requires a budget for paid production calls", () => {
  const guard = resolveSilaCostRuntimeGuard({
    SILA_AI_TIER: "production",
    OPENAI_API_KEY: "configured",
    SILA_AI_ALLOW_PAID_CALLS: "true",
  });

  assert.equal(guard.canUsePaidAi, false);
  assert.ok(guard.missing.includes("SILA_AI_MONTHLY_BUDGET_USD أو SILA_AI_MONTHLY_BUDGET_EGP"));
});

test("Sila cost guard can enable paid AI only with explicit paid flag and budget", () => {
  const guard = resolveSilaCostRuntimeGuard({
    SILA_AI_TIER: "production",
    OPENAI_API_KEY: "configured",
    SILA_AI_ALLOW_PAID_CALLS: "true",
    SILA_AI_MONTHLY_BUDGET_USD: "5",
  });

  assert.equal(guard.canUsePaidAi, true);
  assert.equal(guard.budget.usd, 5);
  assert.equal(guard.canRunAutomatically, false);
});

test("Sila cost guard never allows background model calls unless separately approved", () => {
  const guard = resolveSilaCostRuntimeGuard({
    SILA_AI_TIER: "pilot",
    OPENROUTER_API_KEY: "configured",
    SILA_AI_ALLOW_BACKGROUND_CALLS: "true",
  });

  assert.equal(guard.canUsePilotAi, true);
  assert.equal(guard.canRunAutomatically, true);
});

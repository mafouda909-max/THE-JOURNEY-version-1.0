import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSilaAdvisorBrain } from "../src/lib/sila-advisor-brain";
import { createSilaTravelCase } from "../src/lib/sila-advisor-travel-case";
import { reviewSilaDecisionEvidence } from "../src/lib/sila-evidence-bridge";
import { renderSilaLiveAdvisor, type SilaLiveAdvisorProvider } from "../src/lib/sila-live-advisor";
import { resolveSilaProviderRuntime } from "../src/lib/sila-provider-runtime";
import { resolveSilaRuntimeStatus } from "../src/lib/sila-runtime-status";
import type {
  SilaAdvisorDraftRequest,
  SilaAdvisorDraftResponse,
} from "../src/lib/providers/ai";

const NOW = new Date("2026-10-06T13:00:00.000Z");

function brain() {
  return buildSilaAdvisorBrain(
    createSilaTravelCase(
      "أنا مصري وعايز أسافر تركيا سياحة في ديسمبر بميزانية محدودة",
      NOW,
    ),
  );
}

function mockProvider(ai = true): SilaLiveAdvisorProvider {
  return {
    deterministicSilaAdvisorDraft(draft: SilaAdvisorDraftRequest): SilaAdvisorDraftResponse {
      return {
        text: draft.baseAnswer,
        assistedBy: "deterministic_rules",
        executionMode: "deterministic",
        reviewRequired: true,
        factsLocked: true,
      };
    },
    async assistSilaAdvisorDraft(
      _draft: SilaAdvisorDraftRequest,
      options: { mode: "pilot_free" | "paid_guarded" },
    ): Promise<SilaAdvisorDraftResponse> {
      return ai
        ? {
            text: "صياغة محسّنة بدون إضافة حقائق.",
            assistedBy: options.mode === "pilot_free" ? "ai_openrouter" : "ai_openai",
            executionMode: options.mode,
            reviewRequired: true,
            factsLocked: true,
          }
        : {
            text: "fallback",
            assistedBy: "deterministic_rules",
            executionMode: "deterministic",
            reviewRequired: true,
            factsLocked: true,
          };
    },
  };
}

test("pilot live advisor uses OpenRouter zero-cost policy when OpenRouter is executable", async () => {
  const env = {
    SILA_AI_TIER: "pilot",
    OPENROUTER_API_KEY: "openrouter-key-12345",
  };
  const result = await renderSilaLiveAdvisor(
    {
      brain: brain(),
      evidenceReview: reviewSilaDecisionEvidence(null),
      runtimeStatus: resolveSilaRuntimeStatus(env),
    },
    {
      provider: mockProvider(true),
      providerRuntime: resolveSilaProviderRuntime(env),
    },
  );

  assert.equal(result.status, "AI_DRAFT");
  assert.equal(result.policy, "PILOT_ZERO_COST");
  assert.equal(result.executionMode, "pilot_free");
  assert.equal(result.attemptedAi, true);
  assert.equal(result.factsLocked, true);
});

test("pilot live advisor refuses to spend through Gateway when OpenRouter free route is unavailable", async () => {
  const env = {
    SILA_AI_TIER: "pilot",
    VERCEL_AI_GATEWAY_API_KEY: "gateway-key-12345",
  };
  const result = await renderSilaLiveAdvisor(
    {
      brain: brain(),
      evidenceReview: reviewSilaDecisionEvidence(null),
      runtimeStatus: resolveSilaRuntimeStatus(env),
    },
    {
      provider: mockProvider(true),
      providerRuntime: resolveSilaProviderRuntime(env),
    },
  );

  assert.equal(result.status, "DETERMINISTIC");
  assert.equal(result.policy, "PILOT_ZERO_COST");
  assert.equal(result.attemptedAi, false);
  assert.ok(result.reason.includes("OpenRouter free route"));
});

test("production live advisor requires paid permission and budget before model execution", async () => {
  const blockedEnv = {
    SILA_AI_TIER: "production",
    OPENAI_API_KEY: "openai-key-12345",
  };
  const blocked = await renderSilaLiveAdvisor(
    {
      brain: brain(),
      evidenceReview: reviewSilaDecisionEvidence(null),
      runtimeStatus: resolveSilaRuntimeStatus(blockedEnv),
    },
    {
      provider: mockProvider(true),
      providerRuntime: resolveSilaProviderRuntime(blockedEnv),
    },
  );
  assert.equal(blocked.status, "DETERMINISTIC");
  assert.equal(blocked.attemptedAi, false);

  const allowedEnv = {
    SILA_AI_TIER: "production",
    OPENAI_API_KEY: "openai-key-12345",
    SILA_AI_ALLOW_PAID_CALLS: "true",
    SILA_AI_MONTHLY_BUDGET_USD: "5",
  };
  const allowed = await renderSilaLiveAdvisor(
    {
      brain: brain(),
      evidenceReview: reviewSilaDecisionEvidence(null),
      runtimeStatus: resolveSilaRuntimeStatus(allowedEnv),
    },
    {
      provider: mockProvider(true),
      providerRuntime: resolveSilaProviderRuntime(allowedEnv),
    },
  );
  assert.equal(allowed.status, "AI_DRAFT");
  assert.equal(allowed.policy, "PAID_GUARDED");
  assert.equal(allowed.executionMode, "paid_guarded");
});

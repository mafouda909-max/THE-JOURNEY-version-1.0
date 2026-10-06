import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getSilaProviderHealthPassive,
  probeSilaProviderHealth,
} from "../src/lib/sila-provider-health";

test("provider health passive mode never makes network calls and exposes no secrets", () => {
  const report = getSilaProviderHealthPassive({
    OPENROUTER_API_KEY: "openrouter-secret-12345",
    GEMINI_API_KEY: "gemini-secret-12345",
    SILA_GEMINI_CONTEXT_ENABLED: "true",
    VERCEL_AI_GATEWAY_API_KEY: "gateway-secret-12345",
    OPENAI_API_KEY: "openai-secret-12345",
  });

  assert.equal(report.mode, "PASSIVE");
  assert.equal(report.generationCallsMade, 0);
  assert.equal(report.providers.length, 4);
  assert.ok(report.providers.every((item) => item.activeProbeUsed === false));
  assert.ok(report.providers.every((item) => item.generationUsed === false));
  assert.equal(JSON.stringify(report).includes("openrouter-secret-12345"), false);
  assert.equal(JSON.stringify(report).includes("gemini-secret-12345"), false);
  assert.equal(JSON.stringify(report).includes("gateway-secret-12345"), false);
  assert.equal(JSON.stringify(report).includes("openai-secret-12345"), false);
});

test("active provider health verifies OpenRouter/Gemini/OpenAI without generation and leaves Gateway unverified", async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
    });
    return new Response("{}", { status: 200 });
  };

  const report = await probeSilaProviderHealth(
    {
      OPENROUTER_API_KEY: "openrouter-secret-12345",
      GEMINI_API_KEY: "gemini-secret-12345",
      SILA_GEMINI_CONTEXT_ENABLED: "true",
      VERCEL_AI_GATEWAY_API_KEY: "gateway-secret-12345",
      OPENAI_API_KEY: "openai-secret-12345",
    },
    {
      fetchImpl,
      now: new Date("2026-10-06T15:00:00.000Z"),
    },
  );

  assert.equal(report.mode, "ACTIVE_PROBE");
  assert.equal(report.generationCallsMade, 0);
  assert.equal(calls.length, 3);
  assert.ok(calls.some((call) => call.url === "https://openrouter.ai/api/v1/key"));
  assert.ok(calls.some((call) => call.url.includes("generativelanguage.googleapis.com/v1beta/models/")));
  assert.ok(calls.some((call) => call.url === "https://api.openai.com/v1/models"));
  assert.ok(calls.every((call) => !/chat\/completions|generateContent/i.test(call.url)));

  const openrouter = report.providers.find((item) => item.provider === "openrouter");
  const gemini = report.providers.find((item) => item.provider === "gemini");
  const gateway = report.providers.find((item) => item.provider === "vercel_ai_gateway");
  const openai = report.providers.find((item) => item.provider === "openai");

  assert.equal(openrouter?.state, "VERIFIED");
  assert.equal(gemini?.state, "VERIFIED");
  assert.equal(openai?.state, "VERIFIED");
  assert.equal(gateway?.state, "CONFIGURED_UNVERIFIED");
  assert.equal(gateway?.activeProbeUsed, false);
  assert.equal(report.safeToActivateZeroCostPilot, true);
  assert.equal(report.safeToActivateGeminiContext, true);
});

test("invalid OpenRouter credential fails closed without generation", async () => {
  const calls: string[] = [];
  const report = await probeSilaProviderHealth(
    {
      OPENROUTER_API_KEY: "openrouter-secret-12345",
    },
    {
      fetchImpl: async (input) => {
        calls.push(String(input));
        return new Response("{}", { status: 401 });
      },
    },
  );

  const openrouter = report.providers.find((item) => item.provider === "openrouter");
  assert.equal(openrouter?.state, "INVALID_CREDENTIAL");
  assert.equal(report.safeToActivateZeroCostPilot, false);
  assert.deepEqual(calls, ["https://openrouter.ai/api/v1/key"]);
});

test("Gemini credential without context enable flag can be verified but is not safe to activate context", async () => {
  const report = await probeSilaProviderHealth(
    {
      GEMINI_API_KEY: "gemini-secret-12345",
    },
    {
      fetchImpl: async () => new Response("{}", { status: 200 }),
    },
  );

  const gemini = report.providers.find((item) => item.provider === "gemini");
  assert.equal(gemini?.state, "VERIFIED");
  assert.equal(report.safeToActivateGeminiContext, false);
});

test("network failure degrades provider health without throwing", async () => {
  const report = await probeSilaProviderHealth(
    {
      OPENAI_API_KEY: "openai-secret-12345",
    },
    {
      fetchImpl: async () => {
        throw new Error("network down");
      },
    },
  );

  const openai = report.providers.find((item) => item.provider === "openai");
  assert.equal(openai?.state, "DEGRADED");
  assert.equal(report.generationCallsMade, 0);
});

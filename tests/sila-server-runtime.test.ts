import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as advisorPost } from "../src/app/api/sila/advisor/route";
import { POST as offerReviewPost } from "../src/app/api/sila/offers/review/route";

test("advisor API returns mission control output without claiming fake live AI", async () => {
  const previousOpenRouter = process.env.OPENROUTER_API_KEY;
  const previousOpenAi = process.env.OPENAI_API_KEY;
  const previousGateway = process.env.AI_GATEWAY_API_KEY;
  const previousDedicatedGateway = process.env.VERCEL_AI_GATEWAY_API_KEY;
  const previousLegacyGateway = process.env.VERCEL_AI_GATEWAY_KEY;
  const previousOidc = process.env.VERCEL_OIDC_TOKEN;
  const previousGatewayEnabled = process.env.SILA_VERCEL_GATEWAY_ENABLED;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_AI_GATEWAY_KEY;
  delete process.env.VERCEL_OIDC_TOKEN;
  delete process.env.SILA_VERCEL_GATEWAY_ENABLED;

  try {
    const response = await advisorPost(
      new Request("http://localhost/api/sila/advisor", {
        method: "POST",
        body: JSON.stringify({ message: "أنا مصري وعايز أسافر تركيا سياحة بميزانية محدودة" }),
      }),
    );
    const json = await response.json();

    assert.equal(response.status, 200);
    assert.equal(json.aiRuntime.canCallModel, false);
    assert.equal(json.advisorResponse.status, "DETERMINISTIC");
    assert.equal(json.advisorResponse.attemptedAi, false);
    assert.equal(json.safety.liveAiActive, false);
    assert.equal(json.safety.noFakeSources, true);
    assert.ok(json.tasks.some((task: { kind: string }) => task.kind === "ACTIVATE_AI_RUNTIME"));
  } finally {
    if (previousOpenRouter) process.env.OPENROUTER_API_KEY = previousOpenRouter;
    if (previousOpenAi) process.env.OPENAI_API_KEY = previousOpenAi;
    if (previousGateway) process.env.AI_GATEWAY_API_KEY = previousGateway;
    if (previousDedicatedGateway) process.env.VERCEL_AI_GATEWAY_API_KEY = previousDedicatedGateway;
    if (previousLegacyGateway) process.env.VERCEL_AI_GATEWAY_KEY = previousLegacyGateway;
    if (previousOidc) process.env.VERCEL_OIDC_TOKEN = previousOidc;
    if (previousGatewayEnabled) process.env.SILA_VERCEL_GATEWAY_ENABLED = previousGatewayEnabled;
  }
});

test("offer review API suspends expired offers", async () => {
  const response = await offerReviewPost(
    new Request("http://localhost/api/sila/offers/review", {
      method: "POST",
      body: JSON.stringify({
        status: "published",
        title: "عرض تركيا عائلي",
        priceAmount: 1000,
        currency: "EGP",
        originCity: "القاهرة",
        destinationCity: "إسطنبول",
        destinationCountry: "تركيا",
        includes: ["فندق"],
        excludes: ["الطيران"],
        expiresAt: "2020-01-01T00:00:00.000Z",
        hasVerifiedAgent: true,
        hasCurrentAgentTrust: true,
        hasPriceEvidence: true,
        hasSourceEvidence: true,
      }),
    }),
  );
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.review.decision, "EXPIRED");
  assert.ok(json.tasks.some((task: { kind: string }) => task.kind === "SUSPEND_OFFER"));
});

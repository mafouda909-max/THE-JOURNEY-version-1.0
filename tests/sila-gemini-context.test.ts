import assert from "node:assert/strict";
import { test } from "node:test";
import {
  analyzeSilaGeminiContext,
  detectSilaSensitiveContext,
  resolveSilaGeminiContextRuntime,
} from "../src/lib/sila-gemini-context";

test("Gemini Context Worker stays disabled until explicitly enabled", async () => {
  let called = false;
  const result = await analyzeSilaGeminiContext(
    {
      text: "Public travel policy text that is long enough for analysis.",
      task: "Summarize",
      dataClass: "PUBLIC",
    },
    {
      GEMINI_API_KEY: "gemini-key-12345",
    },
    {
      fetchImpl: async () => {
        called = true;
        throw new Error("must not call");
      },
    },
  );

  assert.equal(result.status, "NOT_CONFIGURED");
  assert.equal(called, false);
  assert.equal(resolveSilaGeminiContextRuntime({ GEMINI_API_KEY: "gemini-key-12345" }).state, "DISABLED");
});

test("Gemini Context Worker blocks sensitive traveler data before any external request", async () => {
  let called = false;
  const text = "اسم العميل أحمد وبريده ahmed@example.com ورقم جوازه passport A1234567.";
  const findings = detectSilaSensitiveContext(text);

  assert.ok(findings.some((item) => item.kind === "EMAIL"));
  assert.ok(findings.some((item) => item.kind === "PASSPORT"));

  const result = await analyzeSilaGeminiContext(
    {
      text,
      task: "لخص المستند",
      dataClass: "REDACTED",
    },
    {
      GEMINI_API_KEY: "gemini-key-12345",
      SILA_GEMINI_CONTEXT_ENABLED: "true",
    },
    {
      fetchImpl: async () => {
        called = true;
        throw new Error("must not call");
      },
    },
  );

  assert.equal(result.status, "BLOCKED");
  assert.equal(called, false);
});

test("Gemini Context Worker analyzes public context and locks facts to supporting excerpts", async () => {
  let seenUrl = "";
  let seenKey = "";
  const sourceText =
    "The airline states that check-in opens 48 hours before departure. Baggage rules vary by fare family.";

  const result = await analyzeSilaGeminiContext(
    {
      text: sourceText,
      task: "Extract the operational facts",
      dataClass: "PUBLIC",
      sourceLabel: "Airline public notice",
    },
    {
      GEMINI_API_KEY: "gemini-key-12345",
      SILA_GEMINI_CONTEXT_ENABLED: "true",
    },
    {
      fetchImpl: async (input, init) => {
        seenUrl = String(input);
        seenKey = new Headers(init?.headers).get("x-goog-api-key") ?? "";
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        summary: "The notice describes check-in timing and baggage variability.",
                        facts: [
                          {
                            statement: "Check-in opens 48 hours before departure.",
                            excerpt: "check-in opens 48 hours before departure",
                            confidence: "HIGH",
                          },
                        ],
                        openQuestions: ["What baggage rules apply to the selected fare family?"],
                        warnings: [],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  );

  assert.equal(result.status, "ANALYZED");
  if (result.status !== "ANALYZED") return;
  assert.equal(result.model, "gemini-3.8-flash");
  assert.equal(result.analysis.facts.length, 1);
  assert.equal(result.factsLockedToInput, true);
  assert.ok(seenUrl.includes("/models/gemini-3.8-flash:generateContent"));
  assert.equal(seenKey, "gemini-key-12345");
});

test("Gemini Context Worker rejects hallucinated facts without a real supporting excerpt", async () => {
  const result = await analyzeSilaGeminiContext(
    {
      text: "This public notice only says that baggage rules vary by fare family.",
      task: "Extract facts",
      dataClass: "PUBLIC",
    },
    {
      GEMINI_API_KEY: "gemini-key-12345",
      SILA_GEMINI_CONTEXT_ENABLED: "true",
    },
    {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        summary: "Summary",
                        facts: [
                          {
                            statement: "The ticket includes two free bags.",
                            excerpt: "two free bags are included",
                            confidence: "HIGH",
                          },
                        ],
                        openQuestions: [],
                        warnings: [],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    },
  );

  assert.equal(result.status, "BLOCKED");
  if (result.status === "BLOCKED") {
    assert.ok(result.reason.includes("supporting excerpt"));
  }
});

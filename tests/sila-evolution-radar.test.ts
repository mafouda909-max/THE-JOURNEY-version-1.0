import assert from "node:assert/strict";
import test from "node:test";
import { runSilaEvolutionRadar } from "../src/lib/sila-evolution-radar";

test("Sila evolution radar separates adopt, pilot, watch, and reject decisions", () => {
  const radar = runSilaEvolutionRadar();

  assert.equal(radar.mode, "EVOLUTION_RADAR_V1");
  assert.ok(radar.adoptionQueue.some((candidate) => candidate.id === "vercel-ai-sdk-gateway"));
  assert.ok(radar.adoptionQueue.some((candidate) => candidate.id === "openai-agents-sdk-ts"));
  assert.ok(radar.adoptionQueue.some((candidate) => candidate.id === "huggingface-model-lab"));
  assert.ok(radar.watchQueue.some((candidate) => candidate.id === "qdrant-or-chroma-rag-memory"));
  assert.ok(radar.candidates.some((candidate) => candidate.decision === "REJECT_FOR_NOW"));
});

test("Sila learning signals improve behavior without inventing official facts", () => {
  const radar = runSilaEvolutionRadar();
  const travelerSignal = radar.learningSignals.find((signal) => signal.id === "traveler-preferences");
  const offerSignal = radar.learningSignals.find((signal) => signal.id === "offer-review-outcomes");

  assert.ok(travelerSignal?.allowedToChange.includes("أولويات الأسئلة"));
  assert.ok(travelerSignal?.forbiddenToChange.includes("شروط فيزا"));
  assert.ok(offerSignal?.forbiddenToChange.some((item) => item.includes("بدون موافقة بشرية")));
  assert.ok(radar.safetyPrinciples.some((principle) => principle.includes("لا تستبدل المصادر الرسمية")));
});


test("Hugging Face is classified as a model lab/red-team pilot, not a production runtime", () => {
  const radar = runSilaEvolutionRadar();
  const hf = radar.candidates.find((candidate) => candidate.id === "huggingface-model-lab");

  assert.equal(hf?.category, "model_lab");
  assert.equal(hf?.decision, "PILOT");
  assert.ok(hf?.nextStep.includes("Model Lab"));
  assert.ok(hf?.risks.some((risk) => risk.includes("Free credits")));
});

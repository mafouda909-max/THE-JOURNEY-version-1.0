import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

test("readiness telemetry records only operational result metadata", () => {
  const route = read("src/app/api/travel/readiness/route.ts");

  assert.match(route, /trackEvent\(\s*"readiness_questions_requested"/);
  assert.match(route, /questionCount: followUpQuestions\.length/);
  assert.match(route, /trackEvent\(\s*"readiness_started"/);
  assert.match(route, /hasTransit: Boolean\(effectiveInput\.transitCountry\)/);
  assert.match(route, /hasPurpose: Boolean\(effectiveInput\.travelPurpose\)/);
  assert.match(route, /hasBudget: effectiveInput\.budgetAmount !== undefined/);
  assert.match(route, /stage: "decision"/);
  assert.match(route, /buildReadinessDecisionDossier/);
  assert.match(route, /trackEvent\(\s*"readiness_completed"/);
  assert.match(route, /status: result\.status/);
  assert.match(route, /checklistCount: result\.checklist\.length/);
  assert.match(route, /warningCount: result\.warnings\.length/);
  assert.match(route, /researchStatus: advisor\.liveResearch\.status/);
  assert.match(route, /offerSuggestionCount: advisor\.offers\.length/);

  const startedAt = route.indexOf('"readiness_started"');
  const completedAt = route.indexOf('"readiness_completed"');
  assert.ok(startedAt >= 0 && completedAt > startedAt);
  const telemetry = route.slice(startedAt, completedAt + 500);

  assert.doesNotMatch(telemetry, /nationality\s*:/);
  assert.doesNotMatch(telemetry, /destination\s*:/);
  assert.doesNotMatch(telemetry, /originCity\s*:/);
  assert.doesNotMatch(telemetry, /passportValidityMonths\s*:/);
  assert.doesNotMatch(telemetry, /budgetAmount\s*:/);
});

test("public readiness endpoint has a bounded abuse budget", () => {
  const route = read("src/app/api/travel/readiness/route.ts");
  assert.match(route, /checkRateLimit/);
  assert.match(route, /travel-readiness-ingress:/);
  assert.match(route, /travel-readiness-\\$\\{isContinuation \\? "continuation" : "start"\\}:/);
  assert.match(route, /isContinuation \\? 60 : 30/);
  assert.match(route, /travel-readiness-research:/);
  assert.match(route, /status: 429/);
  assert.match(route, /Retry-After/);
});

test("admin review desk exposes readiness completion metrics", () => {
  const admin = read("src/components/market/AdminQueue.tsx");
  assert.match(admin, /استخدام جاهزية السفر/);
  assert.match(admin, /funnel\.readiness\.completionRatePct/);
  assert.match(admin, /funnel\.readiness\.resultCounts/);
});

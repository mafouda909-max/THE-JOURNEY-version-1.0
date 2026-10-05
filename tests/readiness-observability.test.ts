import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

test("readiness telemetry records only operational result metadata", () => {
  const route = read("src/app/api/travel/readiness/route.ts");

  assert.match(route, /trackEvent\("readiness_started"/);
  assert.match(route, /hasTransit: Boolean\(transitCountry\)/);
  assert.match(route, /trackEvent\("readiness_completed"/);
  assert.match(route, /status: result\.status/);
  assert.match(route, /checklistCount: result\.checklist\.length/);
  assert.match(route, /warningCount: result\.warnings\.length/);

  const startedAt = route.indexOf('trackEvent("readiness_started"');
  const completedAt = route.indexOf('trackEvent("readiness_completed"');
  const telemetry = route.slice(startedAt, completedAt + 300);

  assert.doesNotMatch(telemetry, /nationality\s*:/);
  assert.doesNotMatch(telemetry, /destination\s*:/);
  assert.doesNotMatch(telemetry, /passportValidityMonths\s*:/);
});

test("public readiness endpoint has a bounded abuse budget", () => {
  const route = read("src/app/api/travel/readiness/route.ts");
  assert.match(route, /checkRateLimit/);
  assert.match(route, /travel-readiness:/);
  assert.match(route, /status: 429/);
  assert.match(route, /Retry-After/);
});

test("admin review desk exposes readiness completion metrics", () => {
  const admin = read("src/components/market/AdminQueue.tsx");
  assert.match(admin, /استخدام جاهزية السفر/);
  assert.match(admin, /funnel\.readiness\.completionRatePct/);
  assert.match(admin, /funnel\.readiness\.resultCounts/);
});

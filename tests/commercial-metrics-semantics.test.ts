import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("commercial health never labels immutable quote economics as realized settlement", () => {
  const route = readFileSync("src/app/api/agency/workspaces/[id]/metrics/route.ts", "utf8");
  const panel = readFileSync("src/app/account/agency/CommercialMetrics.tsx", "utf8");

  assert.match(route, /wonQuotedGrossProfit/);
  assert.match(route, /immutable_winning_quote_versions_not_realized_settlement/);
  assert.doesNotMatch(route, /realizedGrossProfit/);

  assert.match(panel, /Quoted gross profit — won opportunities/);
  assert.match(panel, /ليس ربحًا محققًا/);
  assert.doesNotMatch(panel, />Realized gross profit</);
});

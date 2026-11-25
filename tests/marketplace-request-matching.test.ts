import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MARKETPLACE_REQUEST_RECIPIENT_LIMIT,
  marketplaceCategoryTags,
  providerMatchesMarketplaceCategory,
  rankMarketplaceRecipients,
} from "../src/lib/marketplace-request-matching";

test("marketplace categories require an explicit specialty tag and do not use broad tourism fallback", () => {
  assert.equal(providerMatchesMarketplaceCategory(["hotels"], "hotel"), true);
  assert.equal(providerMatchesMarketplaceCategory(["فنادق"], "hotel"), true);
  assert.equal(providerMatchesMarketplaceCategory(["visa", "tourism"], "visa"), true);
  assert.equal(providerMatchesMarketplaceCategory(["tourism", "travel"], "hotel"), false);
  assert.equal(providerMatchesMarketplaceCategory(["hotel"], "flight"), false);
  assert.ok(marketplaceCategoryTags("flight").includes("طيران"));
});

test("recipient ranking is deterministic and the pilot never routes to more than five providers", () => {
  const ranked = rankMarketplaceRecipients([
    { agentId: 9, responseRate: 90, avgResponseHours: 3, totalTrips: 120 },
    { agentId: 4, responseRate: 95, avgResponseHours: 6, totalTrips: 200 },
    { agentId: 2, responseRate: 95, avgResponseHours: 2, totalTrips: 40 },
    { agentId: 1, responseRate: 95, avgResponseHours: 2, totalTrips: 40 },
  ]);
  assert.deepEqual(ranked.map((item) => item.agentId), [1, 2, 4, 9]);
  assert.equal(MARKETPLACE_REQUEST_RECIPIENT_LIMIT, 5);
  assert.equal(ranked.slice(0, MARKETPLACE_REQUEST_RECIPIENT_LIMIT).length, 4);
});

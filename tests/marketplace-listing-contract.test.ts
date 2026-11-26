import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("public listings endpoint adapts current safe offers and exposes actual category counts", () => {
  const route = read("src/app/api/listings/route.ts");
  const adapter = read("src/lib/marketplace-listing.ts");

  assert.match(route, /getPublishedOffers/);
  assert.match(route, /toPublicMarketplaceListing/);
  assert.match(route, /buildListingCategoryFacets/);
  assert.match(route, /not_live_verified/);
  assert.match(adapter, /legacyOfferId/);
  assert.match(adapter, /provider_published/);
});

test("offer UI does not claim stock or price validity from listing expiry", () => {
  const detail = read("src/app/offers/[id]/page.tsx");
  const card = read("src/components/market/OfferCard.tsx");

  assert.doesNotMatch(detail, /availability:\s*"https:\/\/schema\.org\/InStock"/);
  assert.doesNotMatch(detail, /validThrough:\s*offer\.expiresAt/);
  assert.match(detail, /هذا سعر منشور من مقدم الخدمة/);
  assert.match(card, /التوفر والسعر النهائي يحتاجان تأكيدًا مباشرًا/);
});

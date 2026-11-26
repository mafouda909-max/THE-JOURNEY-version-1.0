import assert from "node:assert/strict";
import test from "node:test";
import {
  buildListingCategoryFacets,
  toPublicMarketplaceListing,
} from "../src/lib/marketplace-listing";
import type { OfferWithAgent } from "../src/lib/data";

function offer(id: number, category: string): OfferWithAgent {
  return {
    id,
    agentId: 7,
    title: "عرض سفر منشور من مقدم خدمة موثق",
    titleEn: null,
    description: "تفاصيل العرض المنشور من مقدم الخدمة وتحتاج تأكيدًا مباشرًا قبل أي التزام.",
    tripType: category,
    originCity: "القاهرة",
    destinationCity: "إسطنبول",
    destinationCountry: "تركيا",
    destinationCountryEn: "Turkey",
    departureDate: null,
    durationDays: 5,
    priceAmount: 25000,
    currency: "EGP",
    priceType: "per_person",
    includes: ["إقامة فندقية"],
    excludes: ["الإنفاق الشخصي"],
    minTravelers: 1,
    maxTravelers: 8,
    status: "published",
    rejectionReason: null,
    heroImage: "https://example.invalid/offer.jpg",
    isFeatured: false,
    viewCount: 0,
    contactCount: 0,
    publishedAt: new Date("2026-11-20T10:00:00.000Z"),
    expiresAt: new Date("2027-02-18T10:00:00.000Z"),
    createdAt: new Date("2026-11-19T10:00:00.000Z"),
    agent: {
      id: 7,
      displayName: "وكالة سفر",
      latinName: "Travel Agency",
      bio: "وكالة سفر موثقة",
      photoUrl: "https://example.invalid/provider.jpg",
      city: "القاهرة",
      country: "مصر",
      licenseType: "agency",
      verificationStatus: "verified",
      trust: {
        status: "reviewed",
        claims: [],
        reviewedAt: "2026-11-20T10:00:00.000Z",
        validUntil: null,
        limitations: ["مراجعة الهوية والنشاط لا تثبت السعر أو التوفر."],
      },
      specialtyTags: ["باقات"],
      languages: ["Arabic"],
      responseRate: 90,
      avgResponseHours: 2,
      totalTrips: 20,
      joinedAt: new Date("2025-01-01T00:00:00.000Z"),
      avgRating: 4.5,
      reviewCount: 3,
    },
  } as OfferWithAgent;
}

test("listing adapter keeps legacy offer identity and typed category", () => {
  const listing = toPublicMarketplaceListing(offer(5, "package"));
  assert.equal(listing.id, "offer:5");
  assert.equal(listing.legacyOfferId, 5);
  assert.equal(listing.kind, "provider_published_travel_offer");
  assert.equal(listing.category, "package");
  assert.equal(listing.categoryLabel, "باقات سياحية");
});

test("listing states provider-published price and unverified availability honestly", () => {
  const listing = toPublicMarketplaceListing(offer(5, "hotel"));
  assert.equal(listing.commercial.source, "provider_published");
  assert.equal(listing.commercial.confirmationRequired, true);
  assert.equal(listing.availability.state, "not_live_verified");
  assert.equal(listing.availability.confirmationRequired, true);
  assert.equal(listing.availability.mode, "direct_provider_inquiry");
  assert.equal(listing.publication.endsAt, "2027-02-18T10:00:00.000Z");
});

test("category facets contain only categories with actual public listings", () => {
  const facets = buildListingCategoryFacets([
    toPublicMarketplaceListing(offer(1, "package")),
    toPublicMarketplaceListing(offer(2, "package")),
    toPublicMarketplaceListing(offer(3, "flight")),
  ]);
  assert.deepEqual(facets.map((item) => [item.key, item.count]), [
    ["package", 2],
    ["flight", 1],
  ]);
  assert.equal(facets.some((item) => item.key === "cruise"), false);
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAgent, parseOffer } from "../src/api/types";

const publicAgent = {
  id: 3,
  displayName: "أحمد الرحلة",
  latinName: "Ahmed",
  bio: "خبرة ١٢ عاماً",
  photoUrl: "https://img.test/a.jpg",
  city: "جدة",
  country: "السعودية",
  licenseType: "agency",
  hasLicense: true,
  verificationStatus: "verified",
  specialtyTags: ["عمرة"],
  languages: ["ar", "en"],
  responseRate: 92,
  avgResponseHours: 4,
  totalTrips: 300,
  joinedAt: "2024-01-01T00:00:00.000Z",
};

describe("public agent contract", () => {
  it("uses a boolean trust signal instead of exposing a license identifier", () => {
    const parsed = parseAgent({
      ...publicAgent,
      licenseNumber: "SHOULD-NOT-BE-CONSUMED",
      verifiedAt: "2026-01-01T00:00:00.000Z",
    });

    assert.ok(parsed);
    assert.equal(parsed.hasLicense, true);
    assert.equal("licenseNumber" in parsed, false);
    assert.equal("verifiedAt" in parsed, false);
  });

  it("preserves the safe agent projection nested in a public offer", () => {
    const offer = parseOffer({
      id: 7,
      agentId: 3,
      title: "عرض موثّق",
      titleEn: null,
      description: "تفاصيل العرض",
      tripType: "package",
      originCity: "القاهرة",
      destinationCity: "إسطنبول",
      destinationCountry: "تركيا",
      destinationCountryEn: "Turkey",
      departureDate: null,
      durationDays: 5,
      priceAmount: 25000,
      currency: "EGP",
      priceType: "per_person",
      includes: [],
      excludes: [],
      minTravelers: 1,
      maxTravelers: 4,
      status: "published",
      heroImage: "https://img.test/offer.jpg",
      isFeatured: false,
      viewCount: 0,
      contactCount: 0,
      publishedAt: "2026-09-01T00:00:00.000Z",
      expiresAt: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      agent: publicAgent,
    });

    assert.ok(offer?.agent);
    assert.equal(offer.agent.hasLicense, true);
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicProviderDirectory,
  filterPublicProviders,
  type RatedPublicProviderProfile,
} from "../src/lib/provider-directory";

function profile(
  id: number,
  licenseType: string,
  displayName: string,
): RatedPublicProviderProfile {
  return {
    id,
    displayName,
    latinName: displayName,
    bio: "ملف عام لمقدم خدمة سفر بعد مراجعة أدلة الهوية والنشاط المطلوبة.",
    photoUrl: "https://example.invalid/provider.jpg",
    city: "القاهرة",
    country: "مصر",
    licenseType,
    verificationStatus: "verified",
    trust: {
      status: "reviewed",
      claims: [],
      reviewedAt: "2026-11-25T00:00:00.000Z",
      validUntil: null,
      limitations: ["لا يمثل التوثيق ضمانًا لتنفيذ كل خدمة."],
    },
    specialtyTags: ["عمرة"],
    languages: ["Arabic"],
    responseRate: 90,
    avgResponseHours: 2,
    totalTrips: 10,
    joinedAt: new Date("2025-01-01T00:00:00.000Z"),
    avgRating: 4.5,
    reviewCount: 2,
  } as RatedPublicProviderProfile;
}

test("public directory uses only supported existing provider kinds", () => {
  const providers = buildPublicProviderDirectory(
    [
      profile(1, "agency", "وكالة"),
      profile(2, "individual", "وكيل"),
      profile(3, "hotel", "مزود فندق غير ممثل في نظام التوثيق الحالي"),
    ],
    [],
  );
  assert.deepEqual(providers.map((provider) => provider.providerKind), ["agency", "individual"]);
  assert.equal(providers.length, 2);
});

test("directory category facets and offer counts come only from supplied public offers", () => {
  const providers = buildPublicProviderDirectory(
    [profile(1, "agency", "وكالة")],
    [
      { agent: { id: 1 }, tripType: "umrah" },
      { agent: { id: 1 }, tripType: "hotel" },
      { agent: { id: 1 }, tripType: "not-a-current-category" },
      { agent: { id: 99 }, tripType: "flight" },
    ],
  );
  assert.equal(providers[0]?.publishedOfferCount, 3);
  assert.deepEqual(providers[0]?.offerCategories.sort(), ["hotel", "umrah"]);
});

test("provider search filters kind, city, text and real offer categories", () => {
  const providers = buildPublicProviderDirectory(
    [
      profile(1, "agency", "وكالة النور"),
      { ...profile(2, "individual", "محمد") , city: "طنطا", specialtyTags: ["طيران"] },
    ],
    [
      { agent: { id: 1 }, tripType: "umrah" },
      { agent: { id: 2 }, tripType: "flight" },
    ],
  );

  assert.equal(filterPublicProviders(providers, { kind: "agency" }).length, 1);
  assert.equal(filterPublicProviders(providers, { city: "طنطا" }).length, 1);
  assert.equal(filterPublicProviders(providers, { query: "النور" }).length, 1);
  assert.equal(filterPublicProviders(providers, { category: "flight" }).length, 1);
  assert.equal(filterPublicProviders(providers, { category: "hotel" }).length, 0);
});

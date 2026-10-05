import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PURPOSE_GUIDES,
  PURPOSE_LABELS,
  advisorAnswerSummary,
  advisorFollowUpQuestions,
  rankReadinessOffers,
} from "../src/lib/readiness-advisor-policy";

const publicTrust = {
  status: "reviewed",
  claims: [{
    kind: "identity",
    label: "هوية مُراجَعة",
    scope: "QA",
    verifiedAt: "2026-10-05T10:00:00.000Z",
    validUntil: "2027-10-05T10:00:00.000Z",
  }],
  reviewedAt: "2026-10-05T10:00:00.000Z",
  validUntil: "2027-10-05T10:00:00.000Z",
  limitations: [],
};

function offer(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    agentId: 4,
    title: "برنامج إسطنبول",
    titleEn: null,
    description: "QA only",
    tripType: "package",
    originCity: "القاهرة",
    destinationCity: "إسطنبول",
    destinationCountry: "تركيا",
    destinationCountryEn: "Turkey",
    departureDate: null,
    durationDays: 5,
    priceAmount: 18000,
    currency: "EGP",
    priceType: "per_person",
    includes: ["Hotel"],
    excludes: [],
    minTravelers: 1,
    maxTravelers: 8,
    status: "published",
    heroImage: "/brand/sila-app-icon.svg",
    isFeatured: false,
    contactCount: 0,
    publishedAt: new Date("2026-10-05T10:00:00.000Z"),
    expiresAt: new Date("2026-11-05T10:00:00.000Z"),
    createdAt: new Date("2026-10-05T10:00:00.000Z"),
    rejectionReason: null,
    agent: {
      id: 4,
      displayName: "وكالة اختبار",
      latinName: "QA Agency",
      bio: "QA",
      photoUrl: "/brand/sila-app-icon.svg",
      city: "القاهرة",
      country: "مصر",
      licenseType: "agency",
      verificationStatus: "verified",
      trust: publicTrust,
      specialtyTags: [],
      languages: ["العربية"],
      responseRate: 90,
      avgResponseHours: 2,
      totalTrips: 0,
      joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    ...overrides,
  } as any;
}

test("advisor purpose policy covers the intended trip reasons without merging work categories", () => {
  assert.deepEqual(
    Object.keys(PURPOSE_GUIDES).sort(),
    ["business", "freelance", "medical", "other", "study", "tourism", "transit", "umrah", "visit", "work"].sort(),
  );
  assert.equal(PURPOSE_LABELS.work, "عمل بعقد أو وظيفة");
  assert.equal(PURPOSE_LABELS.freelance, "عمل حر أو عن بُعد");
  assert.ok(PURPOSE_GUIDES.umrah.topics.some((topic) => topic.includes("الميقات")));
  assert.ok(PURPOSE_GUIDES.transit.questions.some((question) => question.includes("الأمتعة")));
});

test("marketplace matching uses destination, purpose and same-currency budget without inventing FX", () => {
  const input = {
    nationality: "مصري",
    destination: "تركيا",
    passportValidityMonths: 12,
    travelPurpose: "tourism",
    originCity: "القاهرة",
    budgetAmount: 20000,
    budgetCurrency: "EGP",
  } as const;

  const matches = rankReadinessOffers(input, [
    offer(),
    offer({ id: 11, title: "عرض بالدولار", currency: "USD", priceAmount: 300 }),
    offer({ id: 12, title: "عرض دبي", destinationCity: "دبي", destinationCountry: "الإمارات", destinationCountryEn: "UAE" }),
  ]);

  assert.equal(matches.length, 2);
  assert.equal(matches[0]?.id, 10);
  assert.ok(matches[0]?.matchReasons.some((reason) => reason.includes("داخل الميزانية")));
  const usd = matches.find((item) => item.id === 11);
  assert.ok(usd);
  assert.ok(usd.confirmationNeeded.some((reason) => reason.includes("لم تُجرَ مقارنة سعرية")));
  assert.equal(matches.some((item) => item.id === 12), false);
});

test("marketplace matching returns no fabricated fallback when destination has no public match", () => {
  const matches = rankReadinessOffers(
    {
      nationality: "مصري",
      destination: "اليابان",
      passportValidityMonths: 12,
      travelPurpose: "study",
    },
    [offer()],
  );
  assert.deepEqual(matches, []);
});


test("advisor asks only the missing purpose-specific questions before research", () => {
  const base = {
    nationality: "مصري",
    destination: "تركيا",
    passportValidityMonths: 12,
    travelPurpose: "tourism",
  } as const;
  const first = advisorFollowUpQuestions(base);
  assert.deepEqual(first.map((question) => question.id), ["tourism_accommodation", "tourism_onward"]);

  const secondInput = {
    ...base,
    advisorAnswers: { tourism_accommodation: "لسه مرنة" },
  };
  assert.deepEqual(advisorFollowUpQuestions(secondInput).map((question) => question.id), ["tourism_onward"]);

  const complete = {
    ...base,
    advisorAnswers: {
      tourism_accommodation: "لسه مرنة",
      tourism_onward: "نعم",
    },
  };
  assert.deepEqual(advisorFollowUpQuestions(complete), []);
  assert.equal(advisorAnswerSummary(complete).length, 2);
});

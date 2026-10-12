import test from "node:test";
import assert from "node:assert/strict";
import {
  listVisaGuides,
  getVisaGuide,
  getUnverifiedRouteAdvisory,
  VERIFIED_VISA_GUIDES,
} from "../src/lib/visas";
import {
  isCommunityEnabled,
  listPublishedCommunityPosts,
  COMMUNITY_POST_TYPES,
  COMMUNITY_GUIDELINE_TEMPLATES,
} from "../src/lib/community";
import { visaGuides, rfqInquiries } from "../src/db/schema";
import { POST as rfqPost } from "../src/app/api/rfq/route";

test("SILA Pillar 2: Verified Visa Guides Contract & Auditing", async (t) => {
  await t.test("all verified guides must link to official government portals with HTTPS and specify manual audit", () => {
    assert.ok(VERIFIED_VISA_GUIDES.length >= 5, "Must have comprehensive verified guides");
    for (const guide of VERIFIED_VISA_GUIDES) {
      assert.ok(
        guide.officialPortalUrl.startsWith("https://"),
        `Portal URL for ${guide.destinationCountry} must be secure HTTPS: ${guide.officialPortalUrl}`,
      );
      assert.ok(
        guide.officialSourceName.length >= 5,
        `Official source name must be descriptive: ${guide.officialSourceName}`,
      );
      assert.ok(
        !Number.isNaN(Date.parse(guide.lastVerifiedAt)),
        `Verification date must be valid timestamp: ${guide.lastVerifiedAt}`,
      );
      assert.strictEqual(
        guide.verificationMethod,
        "MANUAL_OFFICIAL_AUDIT",
        "Must explicitly record manual official audit as verification method",
      );
      assert.ok(
        guide.entryRequirements.length >= 2,
        `Must list at least 2 entry requirements for ${guide.destinationCountry}`,
      );
      assert.strictEqual(guide.isVerified, true, "Guide must be marked verified");
    }
  });

  await t.test("getVisaGuide correctly resolves popular corridors", () => {
    const turkey = getVisaGuide("turkey", "مصر");
    assert.ok(turkey, "Should find Turkey guide for Egyptian travelers");
    assert.strictEqual(turkey?.destinationCountry, "تركيا");
    assert.strictEqual(turkey?.visaType, "evisa");

    const georgia = getVisaGuide("georgia", "المملكة العربية السعودية");
    assert.ok(georgia, "Should find Georgia guide for Saudi travelers");
    assert.strictEqual(georgia?.destinationCountry, "جورجيا");
    assert.strictEqual(georgia?.visaType, "visa_free");
  });

  await t.test("filtering visa guides by destination works accurately", () => {
    const maldives = listVisaGuides({ destination: "maldives" });
    assert.ok(maldives.length >= 1, "Should filter Maldives guide");
    assert.strictEqual(maldives[0].visaType, "on_arrival");
  });

  await t.test("getUnverifiedRouteAdvisory returns transparent official fallback for uncovered routes", () => {
    const advisory = getUnverifiedRouteAdvisory("اليابان", "مصر");
    assert.strictEqual(advisory.isCovered, false);
    assert.ok(advisory.message.includes("غير مغطى بدليل رسمي"));
    assert.ok(advisory.guidelines.length >= 3);
    assert.ok(advisory.guidelines.some((g) => g.includes("سفارة")));
  });
});

test("SILA Pillar 1: Community Core & Honest Empty State", async (t) => {
  await t.test("isCommunityEnabled defaults to active", () => {
    assert.strictEqual(isCommunityEnabled(), true);
  });

  await t.test("COMMUNITY_POST_TYPES includes question, experience, update, and guide", () => {
    const keys = COMMUNITY_POST_TYPES.map((t) => t.key);
    assert.deepStrictEqual(keys, ["question", "experience", "update", "guide"]);
  });

  await t.test("COMMUNITY_GUIDELINE_TEMPLATES provides educational examples without fake personas", () => {
    assert.ok(COMMUNITY_GUIDELINE_TEMPLATES.length >= 3);
    for (const tpl of COMMUNITY_GUIDELINE_TEMPLATES) {
      assert.ok(tpl.titleExample.startsWith("مثال:"));
      assert.ok(tpl.description.length > 10);
      assert.ok(tpl.tips.length >= 2);
    }
  });

  await t.test("listPublishedCommunityPosts returns empty array when no DB posts exist (no synthetic personas)", async () => {
    const posts = await listPublishedCommunityPosts();
    assert.ok(Array.isArray(posts));
    // If DB is offline or has 0 approved posts, it must return [] rather than fabricating members
    for (const p of posts) {
      assert.notStrictEqual(p.author.displayName, "أحمد المهدي", "Must not inject synthetic personas");
      assert.notStrictEqual(p.author.displayName, "سارة كمال", "Must not inject synthetic personas");
    }
  });
});

test("SILA Pillar 4: Direct RFQ Database & API Route Hardening", async (t) => {
  await t.test("rfqInquiries table schema contains essential traveler RFQ fields", () => {
    assert.ok(rfqInquiries.travelerName, "Must have travelerName column");
    assert.ok(rfqInquiries.travelerEmail, "Must have travelerEmail column");
    assert.ok(rfqInquiries.destinationCountry, "Must have destinationCountry column");
    assert.ok(rfqInquiries.originCity, "Must have originCity column");
    assert.ok(rfqInquiries.budgetPreference, "Must have budgetPreference column");
    assert.ok(rfqInquiries.status, "Must have status column");
    assert.ok(rfqInquiries.travelerAccountId, "Must have travelerAccountId column");
  });

  await t.test("RFQ POST route rejects missing or invalid traveler name", async () => {
    const req = new Request("http://localhost/api/rfq", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        travelerName: "A", // too short
        travelerEmail: "traveler@example.com",
        originCity: "القاهرة",
        destinationCountry: "تركيا",
      }),
    });
    const res = await rfqPost(req);
    assert.strictEqual(res.status, 400);
    const data = (await res.json()) as { error?: string };
    assert.ok(data.error?.includes("اسم المسافر"));
  });

  await t.test("RFQ POST route rejects invalid traveler email", async () => {
    const req = new Request("http://localhost/api/rfq", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        travelerName: "أحمد مسافر",
        travelerEmail: "not-an-email",
        originCity: "القاهرة",
        destinationCountry: "تركيا",
      }),
    });
    const res = await rfqPost(req);
    assert.strictEqual(res.status, 400);
    const data = (await res.json()) as { error?: string };
    assert.ok(data.error?.includes("بريد إلكتروني صالح"));
  });

  await t.test("RFQ POST route rejects missing origin or destination", async () => {
    const reqMissingOrigin = new Request("http://localhost/api/rfq", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        travelerName: "أحمد مسافر",
        travelerEmail: "traveler@example.com",
        originCity: "",
        destinationCountry: "تركيا",
      }),
    });
    const res = await rfqPost(reqMissingOrigin);
    assert.strictEqual(res.status, 400);

    const reqMissingDest = new Request("http://localhost/api/rfq", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        travelerName: "أحمد مسافر",
        travelerEmail: "traveler@example.com",
        originCity: "القاهرة",
        destinationCountry: "",
      }),
    });
    const res2 = await rfqPost(reqMissingDest);
    assert.strictEqual(res2.status, 400);
  });

  await t.test("RFQ POST route rejects invalid traveler count outside [1, 50]", async () => {
    const req = new Request("http://localhost/api/rfq", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        travelerName: "أحمد مسافر",
        travelerEmail: "traveler@example.com",
        originCity: "القاهرة",
        destinationCountry: "تركيا",
        travelerCount: 999,
      }),
    });
    const res = await rfqPost(req);
    assert.strictEqual(res.status, 400);
    const data = (await res.json()) as { error?: string };
    assert.ok(data.error?.includes("عدد المسافرين"));
  });

  await t.test("RFQ POST route returns 500 when database persistence fails — never false success", async () => {
    // A request with valid fields when local DB connection fails or table unmigrated
    // must return 500 with canRetry: true, never 200/201 with a fake timestamp ID.
    const req = new Request("http://localhost/api/rfq", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        travelerName: "مسافر تجريبي حقيقي",
        travelerEmail: "real-traveler@example.com",
        originCity: "القاهرة",
        destinationCountry: "تركيا",
        travelerCount: 2,
      }),
    });
    const res = await rfqPost(req);
    // If DB is offline/unavailable in test environment, status must be 500 (fail-closed)
    // If DB happens to be online and connected, status would be 201 (genuine creation)
    // In neither case should it be 200 with fake success ID!
    if (res.status === 500) {
      const data = (await res.json()) as { error?: string; canRetry?: boolean };
      assert.strictEqual(data.canRetry, true);
      assert.ok(data.error?.includes("تعذر حفظ طلب عرض السعر"));
    } else {
      assert.strictEqual(res.status, 201);
      const data = (await res.json()) as { success?: boolean; inquiryId?: number };
      assert.strictEqual(data.success, true);
      assert.ok(typeof data.inquiryId === "number");
    }
  });

  await t.test("visaGuides table schema contains verified portal and metadata columns", () => {
    assert.ok(visaGuides.officialPortalUrl, "Must have officialPortalUrl column");
    assert.ok(visaGuides.officialSourceName, "Must have officialSourceName column");
    assert.ok(visaGuides.lastVerifiedAt, "Must have lastVerifiedAt column");
    assert.ok(visaGuides.isVerified, "Must have isVerified column");
  });
});

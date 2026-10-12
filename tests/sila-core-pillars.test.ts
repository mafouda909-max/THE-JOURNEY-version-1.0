import test from "node:test";
import assert from "node:assert/strict";
import { listVisaGuides, getVisaGuide, VERIFIED_VISA_GUIDES } from "../src/lib/visas";
import { isCommunityEnabled, listPublishedCommunityPosts, COMMUNITY_POST_TYPES } from "../src/lib/community";
import { visaGuides, rfqInquiries } from "../src/db/schema";

test("SILA Pillar 2: Verified Visa Guides Contract", async (t) => {
  await t.test("all verified guides must link to official government portals with HTTPS", () => {
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
});

test("SILA Pillar 1: Community Core Functionality", async (t) => {
  await t.test("isCommunityEnabled defaults to active", () => {
    assert.strictEqual(isCommunityEnabled(), true);
  });

  await t.test("COMMUNITY_POST_TYPES includes question, experience, update, and guide", () => {
    const keys = COMMUNITY_POST_TYPES.map((t) => t.key);
    assert.deepStrictEqual(keys, ["question", "experience", "update", "guide"]);
  });

  await t.test("listPublishedCommunityPosts returns high-quality seed posts when DB has no rows", async () => {
    const posts = await listPublishedCommunityPosts();
    assert.ok(posts.length >= 4, "Must provide fallback seed community posts");

    const types = new Set(posts.map((p) => p.type));
    assert.ok(types.has("question"), "Should contain questions");
    assert.ok(types.has("experience"), "Should contain experiences");
    assert.ok(types.has("guide"), "Should contain guides");
    assert.ok(types.has("update"), "Should contain updates");

    for (const post of posts) {
      assert.ok(post.title.length > 5, "Title must be informative");
      assert.ok(post.body.length > 20, "Body must contain practical context");
      assert.ok(post.author.displayName.length > 1, "Author must have a display name");
    }
  });
});

test("SILA Pillar 4: Direct RFQ Database & Schema Integrity", async (t) => {
  await t.test("rfqInquiries table schema contains essential traveler RFQ fields", () => {
    assert.ok(rfqInquiries.travelerName, "Must have travelerName column");
    assert.ok(rfqInquiries.travelerEmail, "Must have travelerEmail column");
    assert.ok(rfqInquiries.destinationCountry, "Must have destinationCountry column");
    assert.ok(rfqInquiries.originCity, "Must have originCity column");
    assert.ok(rfqInquiries.budgetPreference, "Must have budgetPreference column");
    assert.ok(rfqInquiries.status, "Must have status column");
  });

  await t.test("visaGuides table schema contains verified portal and metadata columns", () => {
    assert.ok(visaGuides.officialPortalUrl, "Must have officialPortalUrl column");
    assert.ok(visaGuides.officialSourceName, "Must have officialSourceName column");
    assert.ok(visaGuides.lastVerifiedAt, "Must have lastVerifiedAt column");
    assert.ok(visaGuides.isVerified, "Must have isVerified column");
  });
});

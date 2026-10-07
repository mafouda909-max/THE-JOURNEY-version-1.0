import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

const home = read("src/app/page.tsx");
const nav = read("src/components/chrome.tsx");
const advisor = read("src/components/market/SilaAdvisorEntry.tsx");
const readiness = read("src/components/market/TravelReadinessWorkbench.tsx");
const offers = read("src/components/market/OfferCard.tsx");
const offerDetail = read("src/app/offers/[id]/page.tsx");
const agents = read("src/app/agents/page.tsx");
const agentDetail = read("src/app/agents/[id]/page.tsx");
const traveler = read("src/app/account/travel/page.tsx");
const travelerForm = read("src/components/market/TravelerIntentForm.tsx");

test("home explains decision and verification before marketplace inventory", () => {
  assert.match(home, /اعرف/);
  assert.match(home, /قبل ما تختار/);
  assert.match(home, /العرض/);
  assert.match(home, /المصدر/);
  assert.match(home, /النطاق/);
  assert.match(home, /مؤكد/);
  assert.match(home, /مختلف عليه/);
  assert.match(home, /غير معروف/);
  assert.doesNotMatch(home, /SearchModule/);
  assert.doesNotMatch(home, /heroImage/);
});

test("public IA is intent-first and keeps agent entry separate", () => {
  for (const label of ["ابدأ رحلتك", "العروض", "الوكلاء", "كيف نتحقق؟"]) {
    assert.match(nav, new RegExp(label));
  }
  assert.match(nav, /للوكلاء/);
  assert.doesNotMatch(nav, /Admin|Review/);
});

test("advisor is a decision workspace, not a chat transcript", () => {
  assert.match(advisor, /COLLECTING_CONTEXT/);
  assert.match(advisor, /NEEDS_INPUT/);
  assert.match(advisor, /READY_TO_VERIFY/);
  assert.match(advisor, /سؤال واحد فقط/);
  assert.match(advisor, /ما أعرفه/);
  assert.match(advisor, /سأتحقق لك من/);
  assert.doesNotMatch(advisor, /chat|Bubble|message bubble/i);
});

test("readiness leads with confirmed conflicting unknown and source scope freshness", () => {
  assert.match(readiness, /مؤكد/);
  assert.match(readiness, /مختلف عليه/);
  assert.match(readiness, /غير مثبت/);
  assert.match(readiness, /المصادر التي بُني عليها هذا الفحص/);
  assert.match(readiness, /ما الذي تحتاج تفعله الآن/);
  assert.match(readiness, /كل تفاصيل الفحص والأدلة/);
});

test("offers are decision dossiers rather than image cards", () => {
  assert.match(offers, /offer-dossier/);
  assert.match(offers, /المصدر والنطاق/);
  assert.match(offers, /صالح حتى/);
  assert.doesNotMatch(offers, /next\/image/);
  assert.doesNotMatch(offers, /aspect-\[16\/10\]/);
});

test("offer detail follows decision evidence freshness agent next-action hierarchy", () => {
  assert.match(offerDetail, /ملف قرار العرض/);
  assert.match(offerDetail, /هل يناسب سياقك/);
  assert.match(offerDetail, /Source/);
  assert.match(offerDetail, /Scope/);
  assert.match(offerDetail, /Freshness/);
  assert.match(offerDetail, /لم تعن أن صلة|لا تعني أن صلة/);
  assert.match(offerDetail, /الخطوة التالية/);
});

test("agent surfaces use trust passports rather than performance-card marketing", () => {
  assert.match(agents, /Trust Passport/);
  assert.match(agentDetail, /Trust Passport/);
  assert.match(agentDetail, /نطاق الثقة/);
  assert.doesNotMatch(agents, /responseRate|avgResponseHours/);
  assert.doesNotMatch(agentDetail, /totalTrips/);
});

test("traveler workspace prioritizes one next action and preserves saved intent memory", () => {
  assert.match(traveler, /Traveler Memory/);
  assert.match(traveler, /const nextAction/);
  assert.match(traveler, /الخطوة التالية/);
  assert.match(traveler, /كل تفاصيل الرحلة المحفوظة/);
  assert.match(traveler, /travelerSavedIntents/);
});


test("unisolated preview design mode never touches marketplace database reads", () => {
  assert.match(home, /process\.env\.VERCEL_ENV === "preview"/);
  assert.match(home, /!process\.env\.SILA_PREVIEW_DATABASE_URL/);
  const guardIndex = home.indexOf("const previewDesignMode");
  const readIndex = home.indexOf("getFeaturedOffers()");
  assert.ok(guardIndex >= 0 && readIndex > guardIndex);
  assert.match(home, /if \(!previewDesignMode\)/);
});


test("traveler intent form keeps persistent labels and progressive optional detail", () => {
  for (const label of ["اسم الرحلة", "مدينة الانطلاق", "الوجهة", "تاريخ المغادرة", "تاريخ العودة"]) {
    assert.match(travelerForm, new RegExp(label));
  }
  assert.match(travelerForm, /<fieldset/);
  assert.match(travelerForm, /<details/);
  assert.match(travelerForm, /focus-action/);
  assert.match(travelerForm, /min-h-\[52px\]/);
  assert.doesNotMatch(travelerForm, /placeholder="الوجهة \*"/);
});


test("advisor opens verification workspace directly and readiness primary action uses 52px target", () => {
  assert.match(advisor, /verification-check/);
  assert.match(advisor, /details\.open = true/);
  assert.match(advisor, /scrollIntoView/);
  assert.doesNotMatch(advisor, /href="#verification-check"/);
  assert.match(readiness, /min-h-\[52px\]/);
  assert.doesNotMatch(readiness, /min-h-\[48px\]/);
});

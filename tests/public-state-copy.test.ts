import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("public empty and gated states stay user-facing and truthful", () => {
  const community = read("src/app/community/page.tsx");
  assert.doesNotMatch(community, /جاهزة في الكود/u);
  assert.doesNotMatch(community, /migration/iu);
  assert.match(community, /المجتمع لم يُفتح للنشر العام بعد/u);

  const compare = read("src/app/compare/page.tsx");
  assert.doesNotMatch(compare, /Feature gated/iu);
  assert.doesNotMatch(compare, /غير مفعّلة في هذه البيئة/u);
  assert.match(compare, /المقارنة الحية للطيران ليست متاحة بعد/u);

  const join = read("src/app/join/page.tsx");
  assert.doesNotMatch(join, /وسائل الدخول غير مفعّلة في هذه البيئة بعد/u);
  assert.match(join, /الدخول وإنشاء الحسابات متوقفان مؤقتًا/u);

  const offers = read("src/components/market/OffersBrowser.tsx");
  assert.match(offers, /لا توجد عروض منشورة الآن/u);
  assert.match(offers, /inventoryEmpty/);

  const home = read("src/app/page.tsx");
  assert.match(home, /لو مفيش، نقول مفيش/u);
  assert.match(home, /لا تحول المعلومة الناقصة إلى حقيقة/u);
  assert.match(home, /لا حجز ولا دفع في البداية/u);
});

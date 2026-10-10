import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path: string) {
  return fs.readFileSync(path, "utf8");
}

test("zero-supply homepage keeps a live readiness path without fabricating inventory", () => {
  const page = source("src/app/page.tsx");

  assert.match(page, /href="\/readiness"/);
  assert.match(page, /featured\.length > 0/);
  assert.match(page, /لا توجد عروض منشورة نقدر نعرضها الآن\./);
  assert.match(page, /ده أفضل من عرض بيانات تجريبية/);
  assert.match(page, /ابدأ بدون عرض/);
  assert.doesNotMatch(page, /<SearchModule/);
});

test("primary navigation is intent-first and does not advertise gated operational surfaces", () => {
  const chrome = source("src/components/chrome.tsx");
  const primaryLinks = chrome.slice(chrome.indexOf("const publicLinks = ["), chrome.indexOf("function activePath"));

  assert.match(primaryLinks, /href: "\/readiness", label: "ابدأ رحلتك"/);
  assert.match(primaryLinks, /href: "\/offers", label: "العروض"/);
  assert.match(primaryLinks, /href: "\/agents", label: "الوكلاء"/);
  assert.match(primaryLinks, /href: "\/trust", label: "كيف نتحقق\؟"/);
  assert.doesNotMatch(primaryLinks, /href: "\/compare"/);
  assert.doesNotMatch(chrome, /href="\/review"/);
  assert.doesNotMatch(chrome, /href="\/destinations"/);
});

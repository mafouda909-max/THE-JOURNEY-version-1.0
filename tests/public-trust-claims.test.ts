import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("public trust page does not promise unsupported SLA, encryption, or review product behavior", () => {
  const source = readFileSync("src/app/trust/page.tsx", "utf8");

  assert.doesNotMatch(source, /٤٨ ساعة|48 ساعة|خلال يوم عمل/);
  assert.doesNotMatch(source, /مشفرة|encrypted/i);
  assert.doesNotMatch(source, /يحق للمسافر تقييم|نافذة ٢٤ ساعة|ثلاث مخالفات خلال/);
  assert.match(source, /href="\/join\?mode=agent"/);
  assert.match(source, /روابط موقعة قصيرة العمر/);
  assert.match(source, /قرار مراجعة\s*بشري/);
  assert.match(source, /ليست\s*بذاتها إثباتًا للدفع/);
});

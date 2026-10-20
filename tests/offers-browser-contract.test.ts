import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync("src/components/market/OffersBrowser.tsx", "utf8").replace(/\r\n?/g, "\n");

test("offers search keeps the origin filter editable and removable", () => {
  assert.match(source, /const \[origin, setOrigin\] = useState\(initial\.from\)/);
  assert.match(source, /value=\{origin\}/);
  assert.match(source, /onChange=\{\(event\) => setOrigin\(event\.target\.value\)\}/);
  assert.match(source, /const originNeedle = normalise\(origin\)/);
  assert.match(source, /originNeedle && !normalise\(offer\.originCity\)\.includes\(originNeedle\)/);
  assert.doesNotMatch(source, /const origin = normalise\(initial\.from\)/);
});

test("clear filters and the empty-state reset both clear the origin city", () => {
  const reset = source.match(/function reset\(\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.match(reset, /setOrigin\(""/);
  assert.match(reset, /setQuery\(""/);
  assert.match(reset, /setTypes\(\[\]\)/);
  assert.match(reset, /setTravelers\(null\)/);
  assert.match(reset, /setSort\("relevant"\)/);
  assert.match(source, /onClick=\{reset\}[\s\S]{0,240}?مسح الفلاتر/);
  assert.match(source, /onClick=\{reset\}[\s\S]{0,180}?إزالة الفلاتر/);
});

test("origin city participates in active-filter count and search telemetry", () => {
  assert.match(source, /\(origin\.trim\(\) \? 1 : 0\) \+/);
  assert.match(source, /from: origin\.trim\(\) \|\| null/);
  assert.match(source, /source: "offers_browser"/);
  assert.match(source, /name: SearchEventName/);
});

test("offers browser exposes explicit apply and truthful no-results states", () => {
  assert.match(source, /onSubmit=\{recordSearch\}/);
  assert.match(source, />\s*طبّق\s*</);
  assert.match(source, /shown\.length === 0/);
  assert.match(source, /inventoryEmpty/);
  assert.match(source, /لا توجد عروض منشورة الآن\./);
  assert.match(source, /لا توجد نتيجة تطابق هذا السياق\./);
  assert.match(source, /صلة لا تملأ السوق ببيانات تجريبية/);
  assert.match(source, /href="\/readiness"/);
  assert.match(source, /إزالة الفلاتر/);
});

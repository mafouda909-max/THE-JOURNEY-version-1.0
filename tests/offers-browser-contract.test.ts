import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync("src/components/market/OffersBrowser.tsx", "utf8").replace(/\r\n?/g, "\n");

test("offers search keeps the origin filter removable instead of pinning initial.from", () => {
  assert.match(source, /const \[origin, setOrigin\] = useState\(initial\.from\)/);
  assert.match(source, /const originNeedle = normalise\(origin\)/);
  assert.match(source, /originNeedle && !normalise\(offer\.originCity\)\.includes\(originNeedle\)/);
  assert.doesNotMatch(source, /const origin = normalise\(initial\.from\)/);
  assert.match(source, /aria-label=\{`إزالة فلتر مدينة الانطلاق \$\{origin\}`\}/);
  assert.match(source, /function clearOrigin\(\) \{\s*setOrigin\(""\)/);
});

test("clear filters and the empty-state reset both clear the origin city", () => {
  const reset = source.match(/function reset\(\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.match(reset, /setOrigin\(""\)/);
  assert.match(reset, /setQuery\(""\)/);
  assert.match(reset, /setTypes\(\[\]\)/);
  assert.match(reset, /setTravelers\(null\)/);
  assert.match(reset, /setFastOnly\(false\)/);
  assert.match(reset, /setSort\("relevant"\)/);
  assert.match(source, /onClick=\{reset\}[\s\S]{0,320}?عرض كل العروض/);
});

test("origin city participates in active-filter count and search telemetry", () => {
  assert.match(source, /\(origin\.trim\(\) \? 1 : 0\) \+/);
  assert.match(source, /from: origin\.trim\(\) \|\| null/);
  assert.match(source, /\{origin \? ` · انطلاقاً من \$\{origin\}` : ""\}/);
});

test("offers browser exposes explicit search and no-results states", () => {
  assert.match(source, /onSubmit=\{recordSearch\}/);
  assert.match(source, />\s*بحث\s*</);
  assert.match(source, /shown\.length === 0/);
  assert.match(source, /لا نتائج بهذه الدقة\./);
  assert.match(source, /عرض كل العروض/);
});

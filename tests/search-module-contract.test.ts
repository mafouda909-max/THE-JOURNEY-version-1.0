import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync("src/components/market/SearchModule.tsx", "utf8").replace(/\r\n?/g, "\n");

test("homepage origin can be cleared independently after selection", () => {
  assert.match(source, /const \[from, setFrom\] = useState\("الرياض"\)/);
  assert.match(source, /<option value="">كل مدن الانطلاق<\/option>/);
  assert.match(source, /function clearOrigin\(\) \{\s*setFrom\(""\);\s*\}/);
  assert.match(source, /aria-label=\{`إزالة فلتر مدينة الانطلاق \$\{from\}`\}/);
  assert.match(source, /onClick=\{clearOrigin\}/);
});

test("cleared homepage origin is omitted from navigation and telemetry", () => {
  assert.match(source, /if \(from\) params\.set\("from", from\)/);
  assert.match(source, /recordSearch\(\{ from: from \|\| null,/);
  assert.doesNotMatch(source, /params\.set\("from", "الرياض"\)/);
});

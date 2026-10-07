import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync("src/app/globals.css", "utf8");
const tokens = JSON.parse(fs.readFileSync("design/sila.tokens.json", "utf8"));

test("SILA structural grid contract exists", () => {
  assert.match(css, /\.sila-grid-12\s*\{/);
  assert.match(css, /repeat\(12, minmax\(0, 1fr\)\)/);
  assert.match(css, /@container \(min-width: 520px\)/);
  assert.match(css, /@container \(min-width: 860px\)/);
});

test("SILA design tokens define required product geometry", () => {
  assert.equal(tokens.layout.gridColumns.value, 12);
  assert.equal(tokens.layout.touch.value, 52);
  assert.equal(tokens.radius.window.value, 24);
  assert.equal(tokens.radius.hero.value, 32);
  assert.equal(tokens.layout.max.value, 1320);
  assert.equal(tokens.layout.reading.value, 680);
  assert.equal(tokens.layout.decision.value, 880);
});

test("SILA interaction system honors reduced motion", () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\.sila-interactive/);
  assert.match(css, /transition:\s*none !important/);
});

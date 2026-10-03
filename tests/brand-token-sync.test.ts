import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const canonical = JSON.parse(fs.readFileSync("design/sila.tokens.json", "utf8"));
const css = fs.readFileSync("src/styles/sila-generated.css", "utf8");
const mobile = fs.readFileSync("mobile/src/generated-brand-tokens.ts", "utf8");
const theme = fs.readFileSync("src/app/globals.css", "utf8");
const mobileTheme = fs.readFileSync("mobile/src/theme.ts", "utf8");

const TOKENS = [
  ["ink", "#08264A"],
  ["paper", "#F5F1E8"],
  ["signal", "#2E6FD8"],
  ["sky", "#7CC8E8"],
  ["air", "#DFEBF1"],
  ["dark", "#071829"],
] as const;

test("SILA master colors stay synchronized across canonical and generated outputs", () => {
  for (const [name, hex] of TOKENS) {
    assert.equal(canonical.color[name].value.toUpperCase(), hex.toUpperCase());
    assert.ok(css.toUpperCase().includes(hex.toUpperCase()), `generated web tokens are missing ${name} ${hex}`);
    assert.ok(mobile.toUpperCase().includes(hex.toUpperCase()), `generated mobile tokens are missing ${name} ${hex}`);
  }
});

test("runtime themes consume generated SILA variables instead of duplicating hex values", () => {
  assert.match(theme, /--color-deep:\s*var\(--sila-ink\)/);
  assert.match(theme, /--color-signal:\s*var\(--sila-signal\)/);
  assert.match(theme, /--color-sky:\s*var\(--sila-sky\)/);
  assert.match(mobileTheme, /deep:\s*t\.colors\.ink/);
  assert.match(mobileTheme, /signal:\s*t\.colors\.signal/);
  assert.match(mobileTheme, /sky:\s*t\.colors\.sky/);
});

test("brand signal is distinct from semantic verification", () => {
  assert.equal(canonical.color.signal.value, "#2E6FD8");
  assert.equal(canonical.color.verified.value, "#22634A");
  assert.notEqual(
    canonical.color.signal.value.toUpperCase(),
    canonical.color.verified.value.toUpperCase(),
  );
});

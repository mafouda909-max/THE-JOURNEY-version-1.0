import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const canonical = JSON.parse(fs.readFileSync("design/sila.tokens.json", "utf8"));
const css = fs.readFileSync("src/styles/sila-generated.css", "utf8");
const mobile = fs.readFileSync("mobile/src/generated-brand-tokens.ts", "utf8");
const theme = fs.readFileSync("src/app/globals.css", "utf8");
const mobileTheme = fs.readFileSync("mobile/src/theme.ts", "utf8");

const MASTER_TOKENS = ["ink", "paper", "signal", "sky", "air", "dark"] as const;

test("SILA master colors stay synchronized across canonical and generated outputs", () => {
  assert.equal(canonical.meta.version, "5.0");
  for (const name of MASTER_TOKENS) {
    const hex = String(canonical.color[name].value);
    assert.match(hex, /^#[0-9A-F]{6}$/i);
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
  assert.equal(canonical.color.signal.value, "#2643A8");
  assert.equal(canonical.color.verified.value, "#159050");
  assert.notEqual(
    canonical.color.signal.value.toUpperCase(),
    canonical.color.verified.value.toUpperCase(),
  );
});

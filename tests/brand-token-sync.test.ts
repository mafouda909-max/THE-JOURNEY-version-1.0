import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync("src/app/globals.css", "utf8");
const mobile = fs.readFileSync("mobile/src/theme.ts", "utf8");

const TOKENS = [
  ["ink", "#08264A"],
  ["paper", "#F5F1E8"],
  ["clay", "#B2462E"],
  ["apricot", "#FFC5AB"],
  ["air", "#DFEBF1"],
  ["dark", "#071829"],
] as const;

test("SILA master colors stay synchronized across web and mobile", () => {
  for (const [name, hex] of TOKENS) {
    assert.ok(css.toUpperCase().includes(hex.toUpperCase()), `web theme is missing ${name} ${hex}`);
    assert.ok(mobile.toUpperCase().includes(hex.toUpperCase()), `mobile theme is missing ${name} ${hex}`);
  }
});

test("brand accent is distinct from semantic verification", () => {
  assert.match(css, /--color-apricot:\s*#FFC5AB/i);
  assert.match(css, /--color-verified:\s*#22634A/i);
  assert.notEqual("#FFC5AB".toUpperCase(), "#22634A".toUpperCase());
  assert.match(mobile, /apricot:\s*"#FFC5AB"/i);
  assert.match(mobile, /verified:\s*"#22634A"/i);
});

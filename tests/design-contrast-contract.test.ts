import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const tokens = JSON.parse(fs.readFileSync("design/sila.tokens.json", "utf8"));

function rgb(hex: string) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16) / 255);
}

function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const one = luminance(a);
  const two = luminance(b);
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
}

const color = (key: string) => tokens.color[key].value as string;

test("core SILA text and action pairs meet WCAG AA normal-text contrast", () => {
  const pairs: Array<[string, string]> = [
    ["cloud", "signal"],
    ["cloud", "ink"],
    ["text", "paper"],
    ["muted", "cloud"],
    ["verified", "verifiedBg"],
    ["warning", "warningBg"],
    ["error", "errorBg"],
  ];
  for (const [foreground, background] of pairs) {
    assert.ok(contrast(color(foreground), color(background)) >= 4.5, `${foreground} on ${background} must remain >= 4.5:1`);
  }
});

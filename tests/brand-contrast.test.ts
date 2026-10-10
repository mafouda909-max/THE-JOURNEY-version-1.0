import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const rgb = [0, 2, 4].map((offset) => Number.parseInt(clean.slice(offset, offset + 2), 16) / 255);
  const linear = rgb.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const tokens = JSON.parse(fs.readFileSync("design/sila.tokens.json", "utf8"));
const color = (key: string) => String(tokens.color[key].value);

const pairs = [
  ["signal CTA", "#FFFFFF", color("signal"), 4.5],
  ["brand ink on paper", color("ink"), color("paper"), 7],
  ["muted copy on low surface", color("muted"), "#F1F3F7", 4.5],
  ["verified state", color("verified"), color("verifiedBg"), 4.5],
  ["warning state", color("warning"), color("warningBg"), 4.5],
  ["error state", color("error"), color("errorBg"), 4.5],
  ["inverse eyebrow", color("sky"), color("ink"), 4.5],
] as const;

test("SILA current semantic text pairs meet target contrast", () => {
  for (const [name, foreground, background, minimum] of pairs) {
    const ratio = contrast(foreground, background);
    assert.ok(
      ratio >= minimum,
      `${name}: ${foreground} on ${background} is ${ratio.toFixed(2)}:1; expected >= ${minimum}:1`,
    );
  }
});

import assert from "node:assert/strict";
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

const pairs = [
  ["brand CTA", "#FFFFFF", "#2E6FD8", 4.5],
  ["brand ink on paper", "#08264A", "#F5F1E8", 7],
  ["muted copy on paper", "#5F6F7E", "#F5F1E8", 4.5],
  ["verified state", "#22634A", "#E6F1EC", 4.5],
  ["warning state", "#8A5B00", "#FFF3C4", 4.5],
  ["error state", "#A42C32", "#FBE9E8", 4.5],
] as const;

test("SILA core and semantic text pairs meet target contrast", () => {
  for (const [name, foreground, background, minimum] of pairs) {
    const ratio = contrast(foreground, background);
    assert.ok(
      ratio >= minimum,
      `${name}: ${foreground} on ${background} is ${ratio.toFixed(2)}:1; expected >= ${minimum}:1`,
    );
  }
});

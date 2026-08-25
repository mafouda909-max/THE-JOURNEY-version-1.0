import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatDate,
  formatPrice,
  isExpiringSoon,
  daysUntil,
} from "./format";

describe("formatCount — C2 Western numerals", () => {
  it("groups thousands with Western digits only", () => {
    expect(formatCount(12345)).toBe("12,345");
    // Arabic-Indic digits must never appear
    expect(formatCount(12345)).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
  });
  it("handles null/undefined/NaN as zero", () => {
    expect(formatCount(null)).toBe("0");
    expect(formatCount(undefined)).toBe("0");
    expect(formatCount(Number.NaN)).toBe("0");
  });
});

describe("formatPrice — DB_DESIGN §2.6 display contract", () => {
  it("formats '{amount} {currency}'", () => {
    expect(formatPrice(1250, "EGP")).toBe("1,250 EGP");
    expect(formatPrice("999.5", "sar")).toBe("999.5 SAR"); // currency upper-cased
  });
  it("numeric strings are parsed; invalid → empty", () => {
    expect(formatPrice("1200", null)).toBe("1,200");
    expect(formatPrice("abc", "EGP")).toBe("");
    expect(formatPrice(null, "EGP")).toBe("");
  });
});

describe("formatDate — DD/MM/YYYY (SPEC §8)", () => {
  it("pads day and month", () => {
    expect(formatDate("2026-08-05")).toBe("05/08/2026");
    expect(formatDate(new Date(Date.UTC(2026, 11, 31)))).toBe("31/12/2026");
  });
  it("empty-safe", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate("not-a-date")).toBe("");
  });
});

describe("expiring-soon preset (AD-11: ≤7 days)", () => {
  it("flags within window and excludes past", () => {
    const now = Date.now();
    expect(isExpiringSoon(new Date(now + 3 * 86_400_000).toISOString())).toBe(true);
    expect(isExpiringSoon(new Date(now + 7 * 86_400_000).toISOString())).toBe(true);
    expect(isExpiringSoon(new Date(now + 8 * 86_400_000).toISOString())).toBe(false);
    expect(isExpiringSoon(new Date(now - 86_400_000).toISOString())).toBe(false);
  });
  it("daysUntil is ceil-based", () => {
    const d = daysUntil(new Date(Date.now() + 36 * 3600_000).toISOString());
    expect(d).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import { safeLocalPath } from "./navigation";

describe("safeLocalPath", () => {
  it("accepts local absolute paths with query strings", () => {
    expect(safeLocalPath("/offers/abc?x=1")).toBe("/offers/abc?x=1");
    expect(safeLocalPath("/dashboard/contacts")).toBe("/dashboard/contacts");
  });

  it("falls back on empty/null", () => {
    expect(safeLocalPath(null)).toBe("/");
    expect(safeLocalPath("")).toBe("/");
    expect(safeLocalPath(undefined, "/x")).toBe("/x");
  });

  it("rejects absolute URLs and protocol-relative destinations", () => {
    expect(safeLocalPath("https://evil.example")).toBe("/");
    expect(safeLocalPath("http://evil.example/a")).toBe("/");
    expect(safeLocalPath("//evil.example")).toBe("/");
    expect(safeLocalPath("/\\evil.example")).toBe("/");
  });

  it("rejects relative paths and control characters", () => {
    expect(safeLocalPath("offers/1")).toBe("/");
    expect(safeLocalPath("/a\r\nLocation: http://evil")).toBe("/");
    expect(safeLocalPath("/a\u0000b")).toBe("/");
  });

  it("honors custom fallback", () => {
    expect(safeLocalPath("javascript:alert(1)", "/offers")).toBe("/offers");
  });
});

import { describe, expect, it } from "vitest";
import { CONTACT_STATUS_AR, contactStatusTone, ContactStatusLabel } from "./labels";

describe("CONTACT_STATUS_AR", () => {
  it("covers every ratified lifecycle state (DATABASE_DESIGN §2.8)", () => {
    expect(Object.keys(CONTACT_STATUS_AR).sort()).toEqual(
      ["cancelled", "closed", "new", "responded", "viewed"].sort(),
    );
    for (const label of Object.values(CONTACT_STATUS_AR)) {
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(/^[a-z_]+$/); // never a raw enum value
    }
  });
});

describe("contactStatusTone", () => {
  it("maps states to semantic tones", () => {
    expect(contactStatusTone("responded")).toBe("success");
    expect(contactStatusTone("cancelled")).toBe("error");
    expect(contactStatusTone("new")).toBe("warning");
    expect(contactStatusTone("viewed")).toBe("neutral");
    expect(contactStatusTone("closed")).toBe("neutral");
  });
});

describe("ContactStatusLabel", () => {
  it("renders the Arabic label and falls back safely", () => {
    const child = ContactStatusLabel({ status: "new" });
    expect(child).toBe(CONTACT_STATUS_AR.new);
    const fallback = ContactStatusLabel({ status: "unknown_state" });
    expect(fallback).toBe("unknown_state");
    expect(ContactStatusLabel({ status: "viewed", labels: { viewed: "X" } })).toBe("X");
  });
});

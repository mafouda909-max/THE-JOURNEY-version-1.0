import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CONTACT_ERRORS,
  EMAIL_MAX,
  EMAIL_PATTERN,
  EMPTY_CONTACT_DRAFT,
  MESSAGE_MAX,
  MESSAGE_MIN,
  NAME_MAX,
  NAME_MIN,
  TRAVEL_DATES_MAX,
  isContactDraftValid,
  isValidEmail,
  normaliseContactDraft,
  validateContactDraft,
  type ContactDraft,
} from "../src/lib/validation";

const BOUNDS = { id: 7, minTravelers: 2, maxTravelers: 8, status: "published" };

function draft(overrides: Partial<ContactDraft> = {}): ContactDraft {
  return {
    offerId: 7,
    travelerName: "سالم الفهيم",
    travelerEmail: "saalem@example.com",
    travelerCount: 4,
    travelDates: "رمضان — أسبوع",
    message: "هل يتوفر موعد للعائلة في رمضان مع غرف ثلاثية؟",
    ...overrides,
  };
}

describe("limits", () => {
  it("match the server-side validators", () => {
    assert.equal(NAME_MIN, 2);
    assert.equal(MESSAGE_MIN, 10);
    assert.equal(NAME_MAX, 120);
    assert.equal(EMAIL_MAX, 200);
    assert.equal(TRAVEL_DATES_MAX, 200);
    assert.equal(MESSAGE_MAX, 2_000);
    assert.equal(EMAIL_PATTERN.source, "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
  });
});

describe("isValidEmail", () => {
  it("accepts ordinary addresses and rejects padding-free junk", () => {
    assert.equal(isValidEmail("a@b.co"), true);
    assert.equal(isValidEmail("  a@b.co  "), true);
    assert.equal(isValidEmail("a@b"), false);
    assert.equal(isValidEmail("a b@c.co"), false);
    assert.equal(isValidEmail(""), false);
    assert.equal(isValidEmail(`a${"b".repeat(300)}@c.co`), false);
  });
});

describe("validateContactDraft", () => {
  it("accepts a complete draft", () => {
    assert.deepEqual(validateContactDraft(draft(), BOUNDS), {});
    assert.equal(isContactDraftValid(draft(), BOUNDS), true);
  });

  it("reports every failing field at once so the form can highlight them", () => {
    const errors = validateContactDraft(
      draft({ offerId: null, travelerName: "س", travelerEmail: "nope", travelerCount: 20, message: "قصير" }),
      BOUNDS,
    );
    assert.deepEqual(Object.keys(errors).sort(), ["message", "offer", "travelerCount", "travelerEmail", "travelerName"]);
    assert.equal(errors.travelerName, CONTACT_ERRORS.name);
    assert.equal(errors.travelerEmail, CONTACT_ERRORS.email);
    assert.equal(errors.message, CONTACT_ERRORS.message);
    assert.equal(errors.offer, CONTACT_ERRORS.offer);
  });

  it("reuses the server's Arabic copy verbatim", () => {
    const errors = validateContactDraft(draft({ travelerCount: 1 }), BOUNDS);
    assert.equal(errors.travelerCount, "عدد المسافرين لهذا العرض بين 2 و 8.");
    assert.equal(CONTACT_ERRORS.name, "اكتب اسمًا صحيحًا بحد أقصى ١٢٠ حرفًا.");
    assert.equal(CONTACT_ERRORS.message, "اكتب رسالة بين ١٠ و٢٠٠٠ حرف.");
  });

  it("blocks a lead against an unpublished offer before the API returns 404", () => {
    const errors = validateContactDraft(draft(), { ...BOUNDS, status: "pending_review" });
    assert.equal(errors.offer, CONTACT_ERRORS.offerUnavailable);
  });

  it("allows an absent offer context (pre-publication preview) but still checks counts", () => {
    const errors = validateContactDraft(draft({ travelerCount: 0 }), null);
    assert.equal(errors.travelerCount, CONTACT_ERRORS.travelers(1, 99));
    assert.equal(errors.offer, undefined);
  });

  it("rejects over-long values with the same bounded errors as the server", () => {
    const errors = validateContactDraft(
      draft({ travelerName: "ن".repeat(NAME_MAX + 5), message: "م".repeat(MESSAGE_MAX + 1) }),
      BOUNDS,
    );
    assert.equal(errors.travelerName, CONTACT_ERRORS.name);
    assert.equal(errors.message, CONTACT_ERRORS.message);
  });

  it("counts a message at the boundary as valid", () => {
    assert.deepEqual(validateContactDraft(draft({ message: "أ".repeat(MESSAGE_MIN) }), BOUNDS), {});
  });
});

describe("normaliseContactDraft", () => {
  it("trims, lowercases the email and drops an empty travel window", () => {
    const normalised = normaliseContactDraft(
      draft({ travelerName: "  سالم  ", travelerEmail: "  SA@Example.COM ", travelDates: "   " }),
    );
    assert.equal(normalised.travelerName, "سالم");
    assert.equal(normalised.travelerEmail, "sa@example.com");
    assert.equal("travelDates" in normalised, false);
    assert.equal(normalised.offerId, 7);
    assert.equal(normalised.travelerCount, 4);
  });

  it("keeps a travel window and clamps runaway lengths", () => {
    const normalised = normaliseContactDraft(
      draft({ travelDates: "رمضان", message: "طويلة".repeat(2_000), travelerName: "ا".repeat(200) }),
    );
    assert.equal(normalised.travelDates, "رمضان");
    assert.equal((normalised.message ?? "").length, MESSAGE_MAX);
    assert.equal((normalised.travelerName ?? "").length, NAME_MAX);
  });

  it("clamps email and travel dates to the same maxima the server accepts", () => {
    const normalised = normaliseContactDraft(
      draft({ travelerEmail: `${"a".repeat(220)}@example.com`, travelDates: "ت".repeat(260) }),
    );
    assert.equal(normalised.travelerEmail.length, EMAIL_MAX);
    assert.equal(normalised.travelDates?.length, TRAVEL_DATES_MAX);
  });

  it("coerces a blank traveler count to one", () => {
    assert.equal(normaliseContactDraft(draft({ travelerCount: Number.NaN })).travelerCount, 1);
  });
});

describe("EMPTY_CONTACT_DRAFT", () => {
  it("starts at two travelers with no offer bound", () => {
    assert.equal(EMPTY_CONTACT_DRAFT.offerId, null);
    assert.equal(EMPTY_CONTACT_DRAFT.travelerCount, 2);
    assert.equal(EMPTY_CONTACT_DRAFT.message, "");
    assert.equal(EMPTY_CONTACT_DRAFT.travelerName, "");
  });
});

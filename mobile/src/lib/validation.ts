/**
 * Client-side mirror of `POST /api/contact-requests` validation.
 *
 * The server stays authoritative — this only moves the obvious failures in
 * front of the user and saves a round trip on a metered connection. The
 * numeric limits below MUST match `src/app/api/contact-requests/route.ts`;
 * `tests/mobile-contract.test.ts` (root suite) fails CI if they drift, and
 * the Arabic copy is intentionally the same string the server returns.
 */

export const NAME_MIN = 2;
export const NAME_MAX = 80;
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2_000;
export const EMAIL_MAX = 254;
export const TRAVEL_DATES_MAX = 120;

/** Same pattern as the server's `EMAIL_RE`. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CONTACT_ERRORS = {
  name: "نحتاج اسمك الكريم ليعرف الوكيل مع من يتحدث.",
  email: "صيغة البريد الإلكتروني غير صحيحة.",
  message: "اكتب رسالة من عشرة أحرف على الأقل — سؤال حقيقي يستحق رداً حقيقياً.",
  offer: "عرض غير معروف.",
  offerUnavailable: "هذا العرض لم يعد متاحاً.",
  rateLimited:
    "أرسلت طلباً لهذا العرض خلال ٢٤ ساعة — الوكيل على الأرجح يراجع طلبك الأول الآن.",
  travelers: (min: number, max: number) => `عدد المسافرين لهذا العرض بين ${min} و ${max}.`,
} as const;

export interface ContactDraft {
  offerId: number | null;
  travelerName: string;
  travelerEmail: string;
  travelerCount: number;
  travelDates: string;
  message: string;
}

export interface ContactOfferBounds {
  id: number;
  minTravelers: number;
  maxTravelers: number;
  status?: string;
}

export type ContactField = "offer" | "travelerName" | "travelerEmail" | "travelerCount" | "message";
/** Fields the traveler edits directly (i.e. every draft key except `offerId`). */
export type ContactDraftField = Exclude<keyof ContactDraft, "offerId">;
export type ContactFieldErrors = Partial<Record<ContactField, string>>;

export const EMPTY_CONTACT_DRAFT: ContactDraft = {
  offerId: null,
  travelerName: "",
  travelerEmail: "",
  travelerCount: 2,
  travelDates: "",
  message: "",
};

export function isValidEmail(value: string): boolean {
  const email = value.trim();
  return email.length <= EMAIL_MAX && EMAIL_PATTERN.test(email);
}

/**
 * Field-level validation. Empty map ⇒ safe to submit. The API is still the
 * authority: a 422 response overwrites whatever this predicted.
 */
export function validateContactDraft(
  draft: ContactDraft,
  bounds: ContactOfferBounds | null,
): ContactFieldErrors {
  const errors: ContactFieldErrors = {};

  if (!Number.isSafeInteger(draft.offerId) || (draft.offerId ?? 0) <= 0) {
    errors.offer = CONTACT_ERRORS.offer;
  }

  if (typeof bounds === "object" && bounds !== null && bounds.status && bounds.status !== "published") {
    errors.offer = CONTACT_ERRORS.offerUnavailable;
  }

  const name = draft.travelerName.trim();
  if (name.length < NAME_MIN) {
    errors.travelerName = CONTACT_ERRORS.name;
  } else if (name.length > NAME_MAX) {
    errors.travelerName = `الاسم أطول من ${NAME_MAX} حرفاً.`;
  }

  if (!isValidEmail(draft.travelerEmail)) {
    errors.travelerEmail = CONTACT_ERRORS.email;
  }

  const count = Math.trunc(Number(draft.travelerCount));
  if (
    !Number.isFinite(count) ||
    (bounds !== null && (count < bounds.minTravelers || count > bounds.maxTravelers)) ||
    (bounds === null && count < 1)
  ) {
    errors.travelerCount = bounds
      ? CONTACT_ERRORS.travelers(bounds.minTravelers, bounds.maxTravelers)
      : CONTACT_ERRORS.travelers(1, 99);
  }

  const message = draft.message.trim();
  if (message.length < MESSAGE_MIN) {
    errors.message = CONTACT_ERRORS.message;
  } else if (message.length > MESSAGE_MAX) {
    errors.message = `الرسالة أطول من ${MESSAGE_MAX} حرفاً.`;
  }

  return errors;
}

export function isContactDraftValid(draft: ContactDraft, bounds: ContactOfferBounds | null): boolean {
  return Object.keys(validateContactDraft(draft, bounds)).length === 0;
}

/** Trim to the lengths the server accepts, so a submit is never rejected for padding. */
export function normaliseContactDraft(draft: ContactDraft): {
  offerId: number;
  travelerName: string;
  travelerEmail: string;
  travelerCount: number;
  travelDates?: string;
  message: string;
} {
  const travelDates = draft.travelDates.trim().slice(0, TRAVEL_DATES_MAX);
  return {
    offerId: Number(draft.offerId),
    travelerName: draft.travelerName.trim().slice(0, NAME_MAX),
    travelerEmail: draft.travelerEmail.trim().toLowerCase(),
    travelerCount: Math.trunc(Number(draft.travelerCount)) || 1,
    ...(travelDates ? { travelDates } : {}),
    message: draft.message.trim().slice(0, MESSAGE_MAX),
  };
}

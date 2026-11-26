import {
  parseTravelerIntent,
  type TravelerIntent,
} from "@/lib/commercial-domain";

export type MarketplaceInquiryIntentContext = {
  originCity: string | null;
  destinationCity: string;
  departureDate: string | null;
  durationDays: number | null;
  tripType: string;
  travelerCount: number;
  travelDates: string | null;
};

export type MarketplaceInquiryIntentResult =
  | { ok: true; value: TravelerIntent; linkedSavedIntent: boolean }
  | { ok: false; error: string };

const SHAREABLE_INTENT_FIELDS = [
  "originCity",
  "destinations",
  "departureDate",
  "returnDate",
  "flexibilityDays",
  "travelers",
  "budgetAmountMinor",
  "budgetCurrency",
  "budgetBasis",
  "tripType",
  "priorities",
  "constraints",
  "notes",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function addDays(date: string | null, durationDays: number | null): string | null {
  if (!date || !durationDays || durationDays < 1) return null;
  const result = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(result.getTime())) return null;
  result.setUTCDate(result.getUTCDate() + Math.max(0, durationDays - 1));
  return result.toISOString().slice(0, 10);
}

/**
 * Project only the travel-plan fields intentionally selected for sharing when
 * the traveler links a Saved Intent to a provider inquiry.
 *
 * Reserved readiness memory, nationality, account details and unknown fields
 * are deliberately excluded from the agency-facing commercial snapshot.
 * The request's explicit traveler count takes precedence over an older plan.
 */
export function buildMarketplaceInquiryIntent(
  savedSnapshot: unknown | null,
  context: MarketplaceInquiryIntentContext,
): MarketplaceInquiryIntentResult {
  let saved: TravelerIntent | null = null;
  const linkedSavedIntent = savedSnapshot !== null && savedSnapshot !== undefined;

  if (linkedSavedIntent) {
    if (!isRecord(savedSnapshot)) {
      return { ok: false, error: "The linked saved travel plan is invalid and needs traveler review." };
    }

    const shareable: Record<string, unknown> = {};
    for (const field of SHAREABLE_INTENT_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(savedSnapshot, field)) {
        shareable[field] = savedSnapshot[field];
      }
    }

    const parsed = parseTravelerIntent(shareable);
    if (!parsed.ok) {
      return { ok: false, error: "The linked saved travel plan needs to be reviewed before this inquiry can become an agency opportunity." };
    }
    saved = parsed.value;
  }

  const children = saved?.travelers.children ?? 0;
  const infants = saved?.travelers.infants ?? 0;
  const dependants = children + infants;
  if (dependants >= context.travelerCount) {
    return {
      ok: false,
      error: "The submitted traveler count must include the saved children/infants and at least one adult.",
    };
  }
  const travelers = {
    adults: context.travelerCount - dependants,
    children,
    infants,
  };

  const departureDate = saved?.departureDate ?? context.departureDate;
  const returnDate = saved?.returnDate ?? addDays(departureDate, context.durationDays);
  const noteParts = saved
    ? [
        saved.notes ?? null,
        context.travelDates ? `Request-specific dates: ${context.travelDates}` : null,
      ]
    : [context.travelDates];

  const candidate = {
    originCity: saved?.originCity ?? context.originCity,
    destinations: saved?.destinations.length
      ? saved.destinations
      : [context.destinationCity],
    departureDate,
    returnDate,
    flexibilityDays: saved?.flexibilityDays ?? 0,
    travelers,
    budgetAmountMinor: saved?.budgetAmountMinor ?? null,
    budgetCurrency: saved?.budgetCurrency ?? null,
    budgetBasis: saved?.budgetBasis ?? null,
    tripType: saved?.tripType ?? context.tripType,
    priorities: saved?.priorities ?? [],
    constraints: saved?.constraints ?? [],
    notes: noteParts.length ? noteParts.join("\n").slice(0, 4000) : null,
  };

  const parsed = parseTravelerIntent(candidate);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return { ok: true, value: parsed.value, linkedSavedIntent };
}

import { createHash } from "node:crypto";

export const OPPORTUNITY_STAGES = [
  "new",
  "qualified",
  "sourcing",
  "quoted",
  "negotiating",
  "won",
  "lost",
  "cancelled",
] as const;

export const OPPORTUNITY_SOURCES = ["marketplace", "manual", "referral", "repeat", "partner"] as const;
export const QUOTE_STATUSES = ["draft", "sent", "accepted", "declined", "expired", "superseded"] as const;
export const COMMERCIAL_ACTIVITY_TYPES = [
  "quote_sent",
  "quote_viewed",
  "follow_up",
  "client_response",
  "outcome_won",
  "outcome_lost",
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];
export type OpportunitySource = (typeof OPPORTUNITY_SOURCES)[number];
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export type CommercialActivityType = (typeof COMMERCIAL_ACTIVITY_TYPES)[number];

export type TravelerCount = {
  adults: number;
  children: number;
  infants: number;
};

export type TravelerIntent = {
  originCity: string | null;
  destinations: string[];
  departureDate: string | null;
  returnDate: string | null;
  flexibilityDays: number;
  travelers: TravelerCount;
  budgetAmountMinor: number | null;
  budgetCurrency: string | null;
  budgetBasis: "total" | "per_person" | null;
  tripType: string | null;
  priorities: string[];
  constraints: string[];
  notes: string | null;
};

export type QuoteLineInput = {
  kind: "flight" | "hotel" | "transfer" | "activity" | "insurance" | "visa" | "fee" | "other";
  label: string;
  quantity: number;
  currency: string;
  costUnitMinor: number;
  sellUnitMinor: number;
  commissionExpectedMinor: number;
  supplierOptionId: number | null;
  provenance: {
    sourceType: "supplier_quote" | "booking_engine" | "contract" | "manual" | "platform";
    sourceRef: string | null;
    observedAt: string;
    validUntil: string | null;
  };
};

export type QuoteEconomics = {
  currency: string;
  costTotalMinor: number;
  sellTotalMinor: number;
  commissionExpectedMinor: number;
  grossProfitMinor: number;
  marginBps: number;
  markupBps: number;
};

export type MarketplaceProjection = {
  title: string;
  description: string;
  tripType: string;
  originCity: string;
  destinationCity: string;
  destinationCountry: string;
  departureDate: string | null;
  durationDays: number | null;
  priceAmount: number;
  currency: string;
  priceType: "per_person" | "total";
  includes: string[];
  minTravelers: number;
  maxTravelers: number;
  heroImage: string;
};

export type CommercialSignal = {
  kind: "follow_up_due" | "quote_expiring" | "low_margin" | "healthy_margin" | "won_learning";
  severity: "info" | "attention" | "high";
  score: number;
  explanation: string;
  recommendedAction: string;
};

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const CURRENCY_RE = /^[A-Z]{3}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 4000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, max = 240): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned || cleaned.length > max) return null;
  return cleaned;
}

function cleanOptionalText(value: unknown, max = MAX_TEXT): string | null {
  if (value == null || value === "") return null;
  return cleanText(value, max);
}

function cleanStringList(value: unknown, maxItems = 20, maxItemLength = 120): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const items = value.map((item) => cleanText(item, maxItemLength));
  if (items.some((item) => item === null)) return null;
  return [...new Set(items as string[])];
}

function nonNegativeInteger(value: unknown, max = Number.MAX_SAFE_INTEGER): number | null {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max ? Number(value) : null;
}

function positiveInteger(value: unknown, max = Number.MAX_SAFE_INTEGER): number | null {
  const parsed = nonNegativeInteger(value, max);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function currency(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return CURRENCY_RE.test(normalized) ? normalized : null;
}

function isoDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : value;
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(record).every((key) => allowedSet.has(key));
}

export function parseTravelerIntent(input: unknown): ParseResult<TravelerIntent> {
  if (!isRecord(input)) return { ok: false, error: "Traveler intent must be an object." };
  const allowed = [
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
  if (!hasOnlyKeys(input, allowed)) return { ok: false, error: "Traveler intent contains unsupported fields." };

  const destinations = cleanStringList(input.destinations, 8, 120);
  if (!destinations || destinations.length === 0) return { ok: false, error: "At least one destination is required." };

  const travelerRecord = isRecord(input.travelers) ? input.travelers : {};
  if (!hasOnlyKeys(travelerRecord, ["adults", "children", "infants"])) {
    return { ok: false, error: "Traveler counts contain unsupported fields." };
  }
  const adults = positiveInteger(travelerRecord.adults ?? 1, 40);
  const children = nonNegativeInteger(travelerRecord.children ?? 0, 40);
  const infants = nonNegativeInteger(travelerRecord.infants ?? 0, 20);
  if (adults === null || children === null || infants === null) {
    return { ok: false, error: "Traveler counts are invalid." };
  }

  const departureDate = isoDate(input.departureDate);
  const returnDate = isoDate(input.returnDate);
  if (input.departureDate && !departureDate) return { ok: false, error: "Departure date must be YYYY-MM-DD." };
  if (input.returnDate && !returnDate) return { ok: false, error: "Return date must be YYYY-MM-DD." };
  if (departureDate && returnDate && returnDate < departureDate) {
    return { ok: false, error: "Return date cannot be before departure date." };
  }

  const flexibilityDays = nonNegativeInteger(input.flexibilityDays ?? 0, 30);
  if (flexibilityDays === null) return { ok: false, error: "Flexibility must be between 0 and 30 days." };

  let budgetAmountMinor: number | null = null;
  let budgetCurrency: string | null = null;
  let budgetBasis: "total" | "per_person" | null = null;
  if (input.budgetAmountMinor != null || input.budgetCurrency != null || input.budgetBasis != null) {
    budgetAmountMinor = positiveInteger(input.budgetAmountMinor, 9_000_000_000_000);
    budgetCurrency = currency(input.budgetCurrency);
    budgetBasis = input.budgetBasis === "total" || input.budgetBasis === "per_person" ? input.budgetBasis : null;
    if (budgetAmountMinor === null || !budgetCurrency || !budgetBasis) {
      return { ok: false, error: "Budget requires amount, ISO currency, and total/per_person basis." };
    }
  }

  const priorities = cleanStringList(input.priorities ?? [], 20, 120);
  const constraints = cleanStringList(input.constraints ?? [], 20, 160);
  if (!priorities || !constraints) return { ok: false, error: "Priorities or constraints are invalid." };

  return {
    ok: true,
    value: {
      originCity: cleanOptionalText(input.originCity, 120),
      destinations,
      departureDate,
      returnDate,
      flexibilityDays,
      travelers: { adults, children, infants },
      budgetAmountMinor,
      budgetCurrency,
      budgetBasis,
      tripType: cleanOptionalText(input.tripType, 80),
      priorities,
      constraints,
      notes: cleanOptionalText(input.notes, MAX_TEXT),
    },
  };
}

export function parseQuoteLines(input: unknown): ParseResult<QuoteLineInput[]> {
  if (!Array.isArray(input) || input.length === 0 || input.length > 80) {
    return { ok: false, error: "A quote needs between 1 and 80 line items." };
  }

  const lines: QuoteLineInput[] = [];
  const allowedKinds = new Set(["flight", "hotel", "transfer", "activity", "insurance", "visa", "fee", "other"]);
  const allowedSources = new Set(["supplier_quote", "booking_engine", "contract", "manual", "platform"]);

  for (const raw of input) {
    if (!isRecord(raw)) return { ok: false, error: "Quote line must be an object." };
    const label = cleanText(raw.label, 240);
    const quoteCurrency = currency(raw.currency);
    const quantity = positiveInteger(raw.quantity ?? 1, 999);
    const costUnitMinor = nonNegativeInteger(raw.costUnitMinor, 9_000_000_000_000);
    const sellUnitMinor = nonNegativeInteger(raw.sellUnitMinor, 9_000_000_000_000);
    const commissionExpectedMinor = nonNegativeInteger(raw.commissionExpectedMinor ?? 0, 9_000_000_000_000);
    const supplierOptionId = raw.supplierOptionId == null ? null : positiveInteger(raw.supplierOptionId);
    const provenance = isRecord(raw.provenance) ? raw.provenance : null;
    const sourceType = provenance && typeof provenance.sourceType === "string" && allowedSources.has(provenance.sourceType)
      ? provenance.sourceType as QuoteLineInput["provenance"]["sourceType"]
      : null;
    const sourceRef = provenance ? cleanOptionalText(provenance.sourceRef, 500) : null;
    const observedAt = provenance && typeof provenance.observedAt === "string" && !Number.isNaN(Date.parse(provenance.observedAt))
      ? new Date(provenance.observedAt).toISOString()
      : null;
    const validUntil = provenance?.validUntil == null
      ? null
      : typeof provenance.validUntil === "string" && !Number.isNaN(Date.parse(provenance.validUntil))
        ? new Date(provenance.validUntil).toISOString()
        : null;

    if (!allowedKinds.has(String(raw.kind)) || !label || !quoteCurrency || quantity === null || costUnitMinor === null || sellUnitMinor === null || commissionExpectedMinor === null || (raw.supplierOptionId != null && supplierOptionId === null) || !sourceType || !observedAt) {
      return { ok: false, error: "Quote line contains invalid economics or provenance." };
    }
    if (validUntil && validUntil < observedAt) {
      return { ok: false, error: "Supplier validity cannot end before the price was observed." };
    }

    lines.push({
      kind: raw.kind as QuoteLineInput["kind"],
      label,
      quantity,
      currency: quoteCurrency,
      costUnitMinor,
      sellUnitMinor,
      commissionExpectedMinor,
      supplierOptionId,
      provenance: { sourceType, sourceRef, observedAt, validUntil },
    });
  }

  const currencies = new Set(lines.map((line) => line.currency));
  if (currencies.size !== 1) {
    return { ok: false, error: "A quote version must use one commercial currency. Convert supplier costs before quoting." };
  }

  return { ok: true, value: lines };
}

export function calculateQuoteEconomics(lines: readonly QuoteLineInput[]): QuoteEconomics {
  if (lines.length === 0) throw new Error("Cannot calculate economics for an empty quote.");
  const currencies = new Set(lines.map((line) => line.currency));
  if (currencies.size !== 1) throw new Error("Quote economics require a single currency.");

  let costTotalMinor = 0;
  let sellTotalMinor = 0;
  let commissionExpectedMinor = 0;
  for (const line of lines) {
    costTotalMinor += line.costUnitMinor * line.quantity;
    sellTotalMinor += line.sellUnitMinor * line.quantity;
    commissionExpectedMinor += line.commissionExpectedMinor;
  }
  for (const value of [costTotalMinor, sellTotalMinor, commissionExpectedMinor]) {
    if (!Number.isSafeInteger(value)) throw new Error("Quote economics exceed safe integer precision.");
  }

  const grossProfitMinor = sellTotalMinor - costTotalMinor + commissionExpectedMinor;
  const marginBps = sellTotalMinor > 0 ? Math.round((grossProfitMinor / sellTotalMinor) * 10_000) : 0;
  const markupBps = costTotalMinor > 0 ? Math.round(((sellTotalMinor - costTotalMinor) / costTotalMinor) * 10_000) : 0;

  return {
    currency: lines[0]!.currency,
    costTotalMinor,
    sellTotalMinor,
    commissionExpectedMinor,
    grossProfitMinor,
    marginBps,
    markupBps,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

export function quoteVersionDigest(input: {
  quoteId: number;
  version: number;
  intentRevision: number;
  lines: readonly QuoteLineInput[];
  economics: QuoteEconomics;
  clientFacingTerms: string | null;
  validUntil: string | null;
}): string {
  const canonical = JSON.stringify(canonicalize(input));
  return createHash("sha256").update(canonical).digest("hex");
}

export function nextStageForActivity(stage: OpportunityStage, activity: CommercialActivityType): OpportunityStage {
  if (stage === "won" || stage === "lost" || stage === "cancelled") return stage;
  if (activity === "quote_sent") return "quoted";
  if (activity === "quote_viewed" || activity === "follow_up" || activity === "client_response") return "negotiating";
  if (activity === "outcome_won") return "won";
  if (activity === "outcome_lost") return "lost";
  return stage;
}

export function deriveCommercialSignals(input: {
  stage: OpportunityStage;
  economics: QuoteEconomics | null;
  lastActivityAt: string | null;
  quoteValidUntil: string | null;
  now?: string;
}): CommercialSignal[] {
  const now = input.now ? new Date(input.now) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error("Invalid intelligence evaluation time.");
  const signals: CommercialSignal[] = [];

  if (input.economics) {
    if (input.economics.marginBps < 800) {
      signals.push({
        kind: "low_margin",
        severity: "high",
        score: 0.95,
        explanation: `Expected gross margin is ${Math.round(input.economics.marginBps / 100)}%.`,
        recommendedAction: "Review markup, supplier cost, and commission assumptions before the next send.",
      });
    } else if (input.economics.marginBps >= 1500) {
      signals.push({
        kind: "healthy_margin",
        severity: "info",
        score: 0.7,
        explanation: `Expected gross margin is ${Math.round(input.economics.marginBps / 100)}%.`,
        recommendedAction: "Preserve the current economics unless the traveler requests a material scope change.",
      });
    }
  }

  if (["quoted", "negotiating"].includes(input.stage) && input.lastActivityAt) {
    const last = new Date(input.lastActivityAt);
    if (!Number.isNaN(last.getTime())) {
      const days = (now.getTime() - last.getTime()) / 86_400_000;
      if (days >= 3) {
        signals.push({
          kind: "follow_up_due",
          severity: days >= 7 ? "high" : "attention",
          score: Math.min(0.99, 0.6 + days / 20),
          explanation: `No commercial activity has been recorded for ${Math.floor(days)} days.`,
          recommendedAction: "Follow up with a concrete decision question or refreshed option, not a generic reminder.",
        });
      }
    }
  }

  if (input.quoteValidUntil) {
    const validUntil = new Date(input.quoteValidUntil);
    if (!Number.isNaN(validUntil.getTime())) {
      const hours = (validUntil.getTime() - now.getTime()) / 3_600_000;
      if (hours >= 0 && hours <= 48) {
        signals.push({
          kind: "quote_expiring",
          severity: hours <= 12 ? "high" : "attention",
          score: hours <= 12 ? 0.95 : 0.8,
          explanation: `Current supplier-backed quote expires in about ${Math.ceil(hours)} hours.`,
          recommendedAction: "Revalidate price/availability before promising the same commercial terms after expiry.",
        });
      }
    }
  }

  if (input.stage === "won" && input.economics) {
    signals.push({
      kind: "won_learning",
      severity: "info",
      score: 1,
      explanation: "This won opportunity is eligible to feed conversion, margin, destination, and source-channel learning.",
      recommendedAction: "Include this outcome in workspace performance aggregates without exposing traveler PII.",
    });
  }

  return signals;
}

export function buildMarketplaceProjection(input: {
  consent: boolean;
  intent: TravelerIntent;
  economics: QuoteEconomics;
  lines: readonly QuoteLineInput[];
  title: string;
  description: string;
  destinationCountry: string;
  heroImage: string;
}): ParseResult<MarketplaceProjection> {
  if (!input.consent) return { ok: false, error: "Marketplace projection requires explicit agency publication intent." };
  const title = cleanText(input.title, 180);
  const description = cleanText(input.description, 1200);
  const country = cleanText(input.destinationCountry, 120);
  const heroImage = cleanText(input.heroImage, 1000);
  const originCity = input.intent.originCity;
  const destinationCity = input.intent.destinations[0] ?? null;
  if (!title || !description || !country || !heroImage || !originCity || !destinationCity) {
    return { ok: false, error: "Marketplace projection needs public-safe title, description, origin, destination, country, and image." };
  }

  const totalTravelers = input.intent.travelers.adults + input.intent.travelers.children + input.intent.travelers.infants;
  const departure = input.intent.departureDate;
  const returnDate = input.intent.returnDate;
  let durationDays: number | null = null;
  if (departure && returnDate) {
    durationDays = Math.max(1, Math.round((Date.parse(`${returnDate}T00:00:00Z`) - Date.parse(`${departure}T00:00:00Z`)) / 86_400_000));
  }

  const includes = [...new Set(input.lines
    .filter((line) => line.kind !== "fee")
    .map((line) => line.label)
    .slice(0, 20))];
  const tripType = input.intent.tripType ?? "custom";
  const perPerson = totalTravelers > 0 ? Math.ceil(input.economics.sellTotalMinor / totalTravelers) : input.economics.sellTotalMinor;

  return {
    ok: true,
    value: {
      title,
      description,
      tripType,
      originCity,
      destinationCity,
      destinationCountry: country,
      departureDate: departure,
      durationDays,
      priceAmount: perPerson,
      currency: input.economics.currency,
      priceType: "per_person",
      includes,
      minTravelers: Math.max(1, totalTravelers),
      maxTravelers: Math.max(1, totalTravelers),
      heroImage,
    },
  };
}

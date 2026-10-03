export type TravelerIntentSource = "community" | "search" | "offer" | "compare" | "manual";

export type TravelerIntentSnapshot = {
  origin?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  travelers?: number;
  nationality?: string;
  source: TravelerIntentSource;
  sourceRef?: string;
  notes?: string;
  supplierCheckedAt?: string;
};

function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim().replace(/\s+/g, " ");
  return clean && clean.length <= max ? clean : undefined;
}

function dateOnly(value: unknown): string | undefined {
  const text = cleanText(value, 10);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
}

export function normalizeTravelerIntentSnapshot(value: unknown): TravelerIntentSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const source =
    typeof input.source === "string" &&
    ["community", "search", "offer", "compare", "manual"].includes(input.source)
      ? (input.source as TravelerIntentSource)
      : "manual";

  const travelers = Number(input.travelers);
  const normalizedTravelers =
    Number.isInteger(travelers) && travelers >= 1 && travelers <= 14 ? travelers : undefined;

  const supplierCheckedAt = cleanText(input.supplierCheckedAt, 40);
  if (supplierCheckedAt && Number.isNaN(Date.parse(supplierCheckedAt))) return null;

  const snapshot: TravelerIntentSnapshot = {
    source,
    ...(cleanText(input.origin, 80) ? { origin: cleanText(input.origin, 80) } : {}),
    ...(cleanText(input.destination, 80) ? { destination: cleanText(input.destination, 80) } : {}),
    ...(dateOnly(input.departureDate) ? { departureDate: dateOnly(input.departureDate) } : {}),
    ...(dateOnly(input.returnDate) ? { returnDate: dateOnly(input.returnDate) } : {}),
    ...(normalizedTravelers ? { travelers: normalizedTravelers } : {}),
    ...(cleanText(input.nationality, 80) ? { nationality: cleanText(input.nationality, 80) } : {}),
    ...(cleanText(input.sourceRef, 180) ? { sourceRef: cleanText(input.sourceRef, 180) } : {}),
    ...(cleanText(input.notes, 500) ? { notes: cleanText(input.notes, 500) } : {}),
    ...(supplierCheckedAt ? { supplierCheckedAt: new Date(supplierCheckedAt).toISOString() } : {}),
  };

  return snapshot;
}

export function normalizeIntentLabel(value: unknown, fallback = "رحلة محفوظة"): string | null {
  const label = cleanText(value, 120) ?? fallback;
  return label.length >= 2 ? label : null;
}

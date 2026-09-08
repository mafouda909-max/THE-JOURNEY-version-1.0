/**
 * Arabic-first formatting for the mobile UI.
 *
 * Deliberately free of `Intl`: Hermes' ICU coverage varies by build, and the
 * web app already owns the canonical label sets (see `src/lib/format.ts`).
 * These tables are mirrored and guarded by `tests/mobile-contract.test.ts`.
 */

export const TRIP_TYPES = [
  { key: "umrah", label: "عمرة", labelEn: "Umrah" },
  { key: "package", label: "باقات سياحية", labelEn: "Packages" },
  { key: "visa", label: "تأشيرات", labelEn: "Visas" },
  { key: "flight", label: "طيران", labelEn: "Flights" },
  { key: "hotel", label: "فنادق", labelEn: "Hotels" },
  { key: "cruise", label: "رحلات بحرية", labelEn: "Cruises" },
] as const;

export const TRIP_TYPE_KEYS = TRIP_TYPES.map((t) => t.key);

export const CURRENCIES = ["SAR", "AED", "USD", "EGP", "EUR"] as const;

export const CURRENCY_SYMBOLS: Record<string, string> = {
  SAR: "ر.س",
  AED: "د.إ",
  USD: "$",
  EGP: "ج.م",
  EUR: "€",
};

export const PRICE_TYPE_LABELS: Record<string, string> = {
  per_person: "للفرد",
  per_group: "للمجموعة",
  starting_from: "يبدأ من",
};

const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export interface FormatOptions {
  /** Render Latin digits instead of Arabic-Indic (used for email/URL-ish content). */
  latin?: boolean;
  /** Fixed fraction digits (0–4). Trailing zeros are trimmed. */
  decimals?: number;
}

/** Insert thousands separators in a non-negative integer string. */
export function groupThousands(intString: string): string {
  const cleaned = intString.replace(/^0+(?=\d)/, "");
  return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Localise digits deterministically — no `Intl`, no locale surprises. */
export function localiseDigits(input: string, options: FormatOptions = {}): string {
  if (options.latin) return input;
  return input.replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)] ?? d);
}

export function formatNumber(value: number, options: FormatOptions = {}): string {
  if (!Number.isFinite(value)) return localiseDigits("0", options);
  const decimals = Math.max(0, Math.min(4, Math.round(options.decimals ?? 0)));
  const negative = value < 0;
  const [intPart, rawFraction] = Math.abs(value).toFixed(decimals).split(".");
  const fraction = (rawFraction ?? "").replace(/0+$/, "");
  const grouped = groupThousands(intPart ?? "0");
  const rendered = fraction ? `${grouped}.${fraction}` : grouped;
  return `${negative ? "-" : ""}${localiseDigits(rendered, options)}`;
}

export function formatPrice(
  amount: number,
  currency: string,
  priceType?: string,
  options: FormatOptions = {},
): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const value = `${formatNumber(Math.round(amount), options)} ${symbol}`;
  const prefix = PRICE_TYPE_LABELS[priceType ?? ""] ?? "";
  return prefix ? `${prefix} ${value}` : value;
}

export function tripTypeLabel(key: string): string {
  return TRIP_TYPES.find((t) => t.key === key)?.label ?? key;
}

export function tripTypeKeyForFilter(key: string | null): string | undefined {
  return key && key !== "all" ? key : undefined;
}

export function isKnownTripType(key: unknown): key is (typeof TRIP_TYPES)[number]["key"] {
  return typeof key === "string" && TRIP_TYPES.some((t) => t.key === key);
}

/** `2027-03-12T00:00:00.000Z` → `١٢ مارس ٢٠٢٧` (device-local, like the web app). */
export function formatDate(iso: string | null | undefined, options: FormatOptions = {}): string {
  const date = toDateOrNull(iso);
  if (!date) return "—";
  return localiseDigits(
    `${date.getDate()} ${ARABIC_MONTHS[date.getMonth()] ?? ""} ${date.getFullYear()}`,
    options,
  );
}

export function formatDateTime(iso: string | null | undefined, options: FormatOptions = {}): string {
  const date = toDateOrNull(iso);
  if (!date) return "—";
  const hours = date.getHours();
  const suffix = hours < 12 ? "ص" : "م";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return localiseDigits(
    `${formatDate(iso, { ...options, latin: true })} · ${h12}:${minutes} ${suffix}`,
    options,
  );
}

function toDateOrNull(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDuration(days: number | null | undefined, options: FormatOptions = {}): string {
  if (!Number.isFinite(days ?? NaN) || !days || days < 1) return "—";
  const n = Math.round(days);
  if (n === 1) return "يوم واحد";
  if (n === 2) return "يومان";
  if (n <= 10) return `${localiseDigits(String(n), options)} أيام`;
  return `${localiseDigits(String(n), options)} يوماً`;
}

export function formatTravelers(count: number, options: FormatOptions = {}): string {
  const n = Math.max(1, Math.round(count || 1));
  if (n === 1) return "مسافر واحد";
  if (n === 2) return "مسافران";
  if (n <= 10) return `${localiseDigits(String(n), options)} مسافرين`;
  return `${localiseDigits(String(n), options)} مسافراً`;
}

export function formatRating(avgRating: number | undefined, reviewCount: number | undefined): string {
  const count = reviewCount ?? 0;
  if (!avgRating || count === 0) return "لا تقييمات بعد";
  return `${formatNumber(avgRating, { decimals: 1 })} من ٥ (${localiseDigits(String(count))})`;
}

export function formatPercent(value: number, options: FormatOptions = {}): string {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return `${localiseDigits(String(clamped), options)}٪`;
}

/** Human copy for "how long ago", used by the status screen. */
export function formatAgo(
  timestampMs: number | null,
  nowMs: number = Date.now(),
  options: FormatOptions = {},
): string {
  if (!timestampMs || !Number.isFinite(timestampMs)) return "لم يُحدَّث بعد";
  const diff = Math.max(0, nowMs - timestampMs);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `قبل ${localiseDigits(String(minutes), options)} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${localiseDigits(String(hours), options)} ساعة`;
  const days = Math.floor(hours / 24);
  return `قبل ${localiseDigits(String(days), options)} يوم`;
}

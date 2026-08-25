/**
 * Canonical formatting utilities — AD-07 / C2.
 *
 * Rules encoded here (ratified):
 * - Western numerals (0–9) UNIVERSALLY. Never use Arabic locale defaults,
 *   which may emit Arabic-Indic digits; the formatter pins en-US explicitly.
 * - Dates display as DD/MM/YYYY (PRODUCT_SPEC §8); stored UTC.
 * - Price display contract (DATABASE_DESIGN §2.6): "{amount} {currency}" —
 *   basis/type suffixes are UI-dictionary concerns, not formatter concerns.
 * - Components must use these helpers; never call raw toLocaleString variants.
 */

const NUMBER_FORMAT = new Intl.NumberFormat("en-US"); // Western digits, grouping

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0";
  return NUMBER_FORMAT.format(value);
}

/** "1,250" + currency code → "1,250 EGP" (tabular rendering via CSS). */
export function formatPrice(
  amount: number | string | null | undefined,
  currency: string | null | undefined,
): string {
  const n =
    typeof amount === "string" ? Number(amount) : (amount ?? Number.NaN);
  if (!Number.isFinite(n)) return "";
  const cur = (currency ?? "").toUpperCase();
  return cur ? `${NUMBER_FORMAT.format(n)} ${cur}` : NUMBER_FORMAT.format(n);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** ISO date/datetime (or Date) → "DD/MM/YYYY". Empty-safe. */
export function formatDate(
  value: Date | string | null | undefined,
): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** Days until a timestamp (ceil, UTC-based). Negative = past. */
export function daysUntil(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/** AD-11 "expiring soon" preset: ≤7 days remaining (and not already past). */
export function isExpiringSoon(value: Date | string | null | undefined): boolean {
  const days = daysUntil(value);
  return days !== null && days >= 0 && days <= 7;
}

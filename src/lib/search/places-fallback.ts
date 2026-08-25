/**
 * Offline-safe curated place list (readiness-approved: safe manually-curated
 * city names, no codes). Slugs here MUST match db/seeds/reference/0040_priority_cities.sql
 * so URLs remain valid after integration. Phase C swaps the fetcher to
 * search_places(q) RPC (AD-11) — this file then serves as SSR fallback only.
 */

export interface PlaceOption {
  /** Canonical slug (cities.slug §3.6). Undefined = display-only suggestion. */
  slug?: string;
  name_ar: string;
  name_en: string;
  country_ar: string;
  kind: "city" | "airport";
  /** Airport-only: verified IATA (never invented — C1). */
  iata?: string;
}

export const FALLBACK_CITIES: PlaceOption[] = [
  { slug: "cairo",      name_ar: "القاهرة",    name_en: "Cairo",      country_ar: "مصر",       kind: "city" },
  { slug: "alexandria", name_ar: "الإسكندرية", name_en: "Alexandria", country_ar: "مصر",     kind: "city" },
  { slug: "giza",       name_ar: "الجيزة",     name_en: "Giza",       country_ar: "مصر",       kind: "city" },
  { slug: "riyadh",     name_ar: "الرياض",     name_en: "Riyadh",     country_ar: "السعودية",  kind: "city" },
  { slug: "jeddah",     name_ar: "جدة",        name_en: "Jeddah",     country_ar: "السعودية",  kind: "city" },
  { slug: "dammam",     name_ar: "الدمام",     name_en: "Dammam",     country_ar: "السعودية",  kind: "city" },
  { slug: "dubai",      name_ar: "دبي",        name_en: "Dubai",      country_ar: "الإمارات",  kind: "city" },
  { slug: "abu-dhabi",  name_ar: "أبوظبي",     name_en: "Abu Dhabi",  country_ar: "الإمارات",  kind: "city" },
  { slug: "sharjah",    name_ar: "الشارقة",    name_en: "Sharjah",    country_ar: "الإمارات",  kind: "city" },
  { slug: "amman",      name_ar: "عمّان",      name_en: "Amman",      country_ar: "الأردن",    kind: "city" },
  { slug: "aqaba",      name_ar: "العقبة",     name_en: "Aqaba",      country_ar: "الأردن",    kind: "city" },
  { slug: "istanbul",   name_ar: "إسطنبول",    name_en: "Istanbul",   country_ar: "تركيا",     kind: "city" },
  { slug: "ankara",     name_ar: "أنقرة",      name_en: "Ankara",     country_ar: "تركيا",     kind: "city" },
  { slug: "antalya",    name_ar: "أنطاليا",    name_en: "Antalya",    country_ar: "تركيا",     kind: "city" },
  { slug: "izmir",      name_ar: "إزمير",      name_en: "İzmir",      country_ar: "تركيا",     kind: "city" },
];

export function filterFallbackPlaces(query: string): PlaceOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return FALLBACK_CITIES.filter(
    (p) =>
      p.name_ar.includes(query.trim()) ||
      p.name_en.toLowerCase().startsWith(q),
  ).slice(0, 8);
}

export const MARKETPLACE_REQUEST_CATEGORIES = [
  "flight",
  "hotel",
  "umrah",
  "package",
  "visa",
  "cruise",
  "transfer",
  "activity",
  "insurance",
] as const;

export type MarketplaceRequestCategory = (typeof MARKETPLACE_REQUEST_CATEGORIES)[number];

export const MARKETPLACE_REQUEST_CATEGORY_LABELS: Record<MarketplaceRequestCategory, string> = {
  flight: "طيران وتذاكر",
  hotel: "فنادق وإقامة",
  umrah: "عمرة وحج",
  package: "برامج ورحلات",
  visa: "تأشيرات",
  cruise: "رحلات بحرية",
  transfer: "انتقالات",
  activity: "أنشطة وتجارب",
  insurance: "تأمين سفر",
};

const CATEGORY_TAGS: Record<MarketplaceRequestCategory, readonly string[]> = {
  flight: ["flight", "flights", "airline", "airlines", "air_ticket", "air tickets", "طيران", "تذاكر طيران", "تذاكر"],
  hotel: ["hotel", "hotels", "accommodation", "stays", "فنادق", "اقامة", "إقامة"],
  umrah: ["umrah", "hajj", "pilgrimage", "عمرة", "حج"],
  package: ["package", "packages", "tour", "tours", "holiday", "holidays", "رحلات", "برامج", "برامج سياحية"],
  visa: ["visa", "visas", "entry visa", "تأشيرة", "تأشيرات"],
  cruise: ["cruise", "cruises", "رحلات بحرية", "كروز"],
  transfer: ["transfer", "transfers", "transport", "transportation", "انتقالات", "نقل"],
  activity: ["activity", "activities", "excursion", "excursions", "experience", "experiences", "أنشطة", "تجارب"],
  insurance: ["insurance", "travel insurance", "تأمين سفر", "تأمين"],
};

function normalizeTag(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[ـ]/g, "")
    .replace(/[\s_-]+/g, " ");
}

export function marketplaceCategoryTags(category: MarketplaceRequestCategory): string[] {
  return CATEGORY_TAGS[category].map(normalizeTag);
}

export function providerMatchesMarketplaceCategory(
  specialtyTags: readonly string[],
  category: MarketplaceRequestCategory,
): boolean {
  const accepted = new Set(marketplaceCategoryTags(category));
  return specialtyTags.some((tag) => accepted.has(normalizeTag(tag)));
}

export type MarketplaceRecipientCandidate = {
  agentId: number;
  responseRate: number;
  avgResponseHours: number;
  totalTrips: number;
};

export function rankMarketplaceRecipients<T extends MarketplaceRecipientCandidate>(candidates: readonly T[]): T[] {
  return [...candidates].sort((a, b) =>
    b.responseRate - a.responseRate ||
    a.avgResponseHours - b.avgResponseHours ||
    b.totalTrips - a.totalTrips ||
    a.agentId - b.agentId
  );
}

export const MARKETPLACE_REQUEST_RECIPIENT_LIMIT = 5;

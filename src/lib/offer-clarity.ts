export type OfferClarityInput = {
  title?: string;
  description?: string;
  originCity?: string;
  destinationCity?: string;
  destinationCountry?: string;
  priceAmount?: string | number;
  priceType?: string;
  durationDays?: string | number;
  includes?: string;
  excludes?: string;
};

export type OfferClarityResult = {
  score: number;
  label: "يحتاج تفاصيل" | "واضح" | "واضح جدًا";
  checks: Array<{ key: string; label: string; done: boolean; weight: number }>;
};

const lines = (value?: string) =>
  (value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

export function scoreOfferClarity(input: OfferClarityInput): OfferClarityResult {
  const title = (input.title ?? "").trim();
  const description = (input.description ?? "").trim();
  const price = Number(input.priceAmount ?? 0);
  const duration = Number(input.durationDays ?? 0);

  const checks = [
    { key: "title", label: "عنوان وصفي", done: title.length >= 20, weight: 12 },
    { key: "description", label: "وصف كافٍ", done: description.length >= 120, weight: 18 },
    {
      key: "route",
      label: "الانطلاق والوجهة",
      done: Boolean(input.originCity?.trim() && input.destinationCity?.trim() && input.destinationCountry?.trim()),
      weight: 15,
    },
    {
      key: "price",
      label: "السعر وأساسه",
      done: Number.isFinite(price) && price >= 100 && Boolean(input.priceType),
      weight: 15,
    },
    { key: "duration", label: "المدة", done: Number.isFinite(duration) && duration >= 1, weight: 10 },
    { key: "includes", label: "المشمولات", done: lines(input.includes).length >= 2, weight: 18 },
    { key: "excludes", label: "المستثنيات", done: lines(input.excludes).length >= 1, weight: 12 },
  ];

  const score = checks.reduce((sum, item) => sum + (item.done ? item.weight : 0), 0);
  const label = score >= 85 ? "واضح جدًا" : score >= 60 ? "واضح" : "يحتاج تفاصيل";

  return { score, label, checks };
}

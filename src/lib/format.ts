export function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString("en-US")} ${currency}`;
}

export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatDay(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function daysLeft(d: Date | null): number | null {
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

export function timeAgo(d: Date): string {
  const minutes = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `قبل ${days} ${days === 1 ? "يوم" : "أيام"}`;
  return formatDay(d);
}

export const TRIP_TYPES = [
  { key: "umrah", label: "عمرة", labelEn: "Umrah" },
  { key: "package", label: "باقات سياحية", labelEn: "Packages" },
  { key: "visa", label: "تأشيرات", labelEn: "Visas" },
  { key: "flight", label: "طيران", labelEn: "Flights" },
  { key: "hotel", label: "فنادق", labelEn: "Hotels" },
  { key: "cruise", label: "رحلات بحرية", labelEn: "Cruises" },
] as const;

export const tripTypeLabel = (key: string): string =>
  TRIP_TYPES.find((t) => t.key === key)?.label ?? key;

export const PRICE_TYPE_LABELS: Record<string, string> = {
  per_person: "للفرد",
  per_group: "للمجموعة",
  starting_from: "يبدأ من",
};

export const pexels = (id: number, portrait = false) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&${portrait ? "h=1200&w=800" : "h=627&w=1200"}`;

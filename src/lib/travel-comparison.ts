import type { CanonicalFlightOffer } from "@/lib/travel-suppliers/types";

export type FlightComparisonRow = {
  offer: CanonicalFlightOffer;
  badges: string[];
  facts: {
    price: string;
    duration: string;
    stops: string;
    baggage: string;
    cabin: string;
    source: string;
    freshness: string;
  };
};

function durationLabel(minutes: number | null): string {
  if (minutes === null) return "غير متاح";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest} د`;
  return rest ? `${hours} س ${rest} د` : `${hours} س`;
}

function baggageLabel(offer: CanonicalFlightOffer): string {
  const bag = offer.includedCheckedBags;
  if (!bag) return "يحتاج تأكيد";
  if (bag.weightKg) return `${bag.weightKg} كجم`;
  if (bag.quantity) return `${bag.quantity} حقيبة`;
  return "يحتاج تأكيد";
}

export function compareFlightOffers(
  offers: CanonicalFlightOffer[],
): FlightComparisonRow[] {
  if (offers.length === 0) return [];

  const sameCurrency = offers.every(
    (offer) => offer.price.currency === offers[0]?.price.currency,
  );
  const cheapestId = sameCurrency
    ? [...offers].sort((a, b) => a.price.total - b.price.total)[0]?.id
    : null;
  const shortestId = [...offers]
    .filter((offer) => offer.durationMinutes !== null)
    .sort((a, b) => (a.durationMinutes ?? Infinity) - (b.durationMinutes ?? Infinity))[0]?.id;
  const fewestStops = Math.min(...offers.map((offer) => offer.stops));

  return offers
    .map((offer) => {
      const badges: string[] = [];
      if (offer.id === cheapestId) badges.push("أقل سعر في النتائج الحالية");
      if (offer.id === shortestId) badges.push("أقصر مدة");
      if (offer.stops === fewestStops) badges.push(offer.stops === 0 ? "مباشر" : "توقفات أقل");

      return {
        offer,
        badges,
        facts: {
          price: `${offer.price.total.toLocaleString("en-US")} ${offer.price.currency}`,
          duration: durationLabel(offer.durationMinutes),
          stops: offer.stops === 0 ? "مباشر" : `${offer.stops} توقف`,
          baggage: baggageLabel(offer),
          cabin: offer.cabin ?? "يحتاج تأكيد",
          source: `${offer.source.provider} · مصدر مورد`,
          freshness:
            offer.freshnessMinutes <= 1
              ? "تم التحقق الآن"
              : `منذ ${offer.freshnessMinutes} دقيقة`,
        },
      };
    })
    .sort((a, b) => {
      if (sameCurrency && a.offer.price.total !== b.offer.price.total) {
        return a.offer.price.total - b.offer.price.total;
      }
      return (a.offer.durationMinutes ?? Infinity) - (b.offer.durationMinutes ?? Infinity);
    });
}

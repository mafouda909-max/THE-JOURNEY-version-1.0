import type { OfferWithAgent } from "@/lib/data";
import type { PublicAgentTrust } from "@/lib/public-agent";
import { tripTypeLabel, PRICE_TYPE_LABELS } from "@/lib/format";

export type PublicMarketplaceListing = {
  id: string;
  legacyOfferId: number;
  kind: "provider_published_travel_offer";
  category: string;
  categoryLabel: string;
  title: string;
  description: string;
  image: string;
  route: {
    originCity: string;
    destinationCity: string;
    destinationCountry: string;
    destinationCountryEn: string;
  };
  travel: {
    departureDate: string | null;
    durationDays: number | null;
    minTravelers: number;
    maxTravelers: number;
  };
  commercial: {
    amount: number;
    currency: string;
    basis: string;
    basisLabel: string;
    source: "provider_published";
    confirmationRequired: true;
  };
  availability: {
    state: "not_live_verified";
    confirmationRequired: true;
    mode: "direct_provider_inquiry";
  };
  publication: {
    publishedAt: string | null;
    endsAt: string | null;
  };
  provider: {
    id: number;
    name: string;
    kind: "agency" | "individual";
    trust: PublicAgentTrust;
  };
  links: {
    details: string;
    providerProfile: string;
    inquiry: string;
  };
};

/**
 * A compatibility adapter from the existing package-shaped offers table to a
 * stable marketplace listing contract. It does not infer inventory, booking,
 * price validity, or a live provider connection from publication status.
 */
export function toPublicMarketplaceListing(
  offer: OfferWithAgent,
): PublicMarketplaceListing {
  const providerKind = offer.agent.licenseType === "agency"
    ? "agency"
    : "individual";

  return {
    id: "offer:" + offer.id,
    legacyOfferId: offer.id,
    kind: "provider_published_travel_offer",
    category: offer.tripType,
    categoryLabel: tripTypeLabel(offer.tripType),
    title: offer.title,
    description: offer.description,
    image: offer.heroImage,
    route: {
      originCity: offer.originCity,
      destinationCity: offer.destinationCity,
      destinationCountry: offer.destinationCountry,
      destinationCountryEn: offer.destinationCountryEn,
    },
    travel: {
      departureDate: offer.departureDate?.toISOString() ?? null,
      durationDays: offer.durationDays,
      minTravelers: offer.minTravelers,
      maxTravelers: offer.maxTravelers,
    },
    commercial: {
      amount: offer.priceAmount,
      currency: offer.currency,
      basis: offer.priceType,
      basisLabel: PRICE_TYPE_LABELS[offer.priceType] ?? offer.priceType,
      source: "provider_published",
      confirmationRequired: true,
    },
    availability: {
      state: "not_live_verified",
      confirmationRequired: true,
      mode: "direct_provider_inquiry",
    },
    publication: {
      publishedAt: offer.publishedAt?.toISOString() ?? null,
      endsAt: offer.expiresAt?.toISOString() ?? null,
    },
    provider: {
      id: offer.agent.id,
      name: offer.agent.displayName,
      kind: providerKind,
      trust: offer.agent.trust,
    },
    // The existing offer detail page owns the inquiry form, saved-intent binding,
    // and traveler -> agency lineage. Keep that behavior as the single write path.
    links: {
      details: "/offers/" + offer.id,
      providerProfile: "/agents/" + offer.agent.id,
      inquiry: "/offers/" + offer.id,
    },
  };
}

export type ListingCategoryFacet = {
  key: string;
  label: string;
  count: number;
};

export function buildListingCategoryFacets(
  listings: PublicMarketplaceListing[],
): ListingCategoryFacet[] {
  const counts = new Map<string, number>();
  for (const listing of listings) {
    counts.set(listing.category, (counts.get(listing.category) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => ({
      key,
      label: tripTypeLabel(key),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

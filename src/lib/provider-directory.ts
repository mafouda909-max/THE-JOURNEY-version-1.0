import type { PublicAgent } from "@/lib/public-agent";
import { TRIP_TYPES } from "@/lib/format";

export type ProviderKind = "agency" | "individual";
export type RatedPublicProviderProfile = PublicAgent & {
  avgRating: number;
  reviewCount: number;
};

export type PublicProviderDirectoryEntry = RatedPublicProviderProfile & {
  providerKind: ProviderKind;
  providerKindLabel: string;
  publishedOfferCount: number;
  offerCategories: string[];
};

export type ProviderDirectoryFilters = {
  query?: string;
  city?: string;
  kind?: string;
  category?: string;
};

const PROVIDER_KIND_LABELS: Record<ProviderKind, string> = {
  agency: "وكالة سفر",
  individual: "وكيل سفر مستقل",
};

function normalise(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ar-EG");
}

/**
 * Build a public-facing directory from the existing, trust-filtered agent
 * projection and current published-offer projection. No new identity records
 * or private verification fields are introduced.
 */
export function buildPublicProviderDirectory(
  profiles: RatedPublicProviderProfile[],
  offers: Array<{ agent: { id: number }; tripType: string }>,
): PublicProviderDirectoryEntry[] {
  const supplyByProvider = new Map<number, { count: number; categories: Set<string> }>();

  for (const offer of offers) {
    const existing = supplyByProvider.get(offer.agent.id) ?? {
      count: 0,
      categories: new Set<string>(),
    };
    existing.count += 1;
    if (TRIP_TYPES.some((item) => item.key === offer.tripType)) {
      existing.categories.add(offer.tripType);
    }
    supplyByProvider.set(offer.agent.id, existing);
  }

  return profiles.flatMap((profile) => {
    if (profile.licenseType !== "agency" && profile.licenseType !== "individual") {
      return [];
    }

    const supply = supplyByProvider.get(profile.id);
    const providerKind = profile.licenseType;

    return [{
      ...profile,
      providerKind,
      providerKindLabel: PROVIDER_KIND_LABELS[providerKind],
      publishedOfferCount: supply?.count ?? 0,
      offerCategories: [...(supply?.categories ?? new Set<string>())],
    }];
  });
}

/** Shared search/filter semantics for the server page and public API. */
export function filterPublicProviders(
  providers: PublicProviderDirectoryEntry[],
  filters: ProviderDirectoryFilters,
): PublicProviderDirectoryEntry[] {
  const query = normalise(filters.query ?? "");
  const city = normalise(filters.city ?? "");
  const kind = filters.kind === "agency" || filters.kind === "individual"
    ? filters.kind
    : "";
  const category = filters.category ?? "";

  return providers.filter((provider) => {
    if (kind && provider.providerKind !== kind) return false;
    if (category && !provider.offerCategories.includes(category)) return false;

    const location = normalise(provider.city + " " + provider.country);
    if (city && !location.includes(city)) return false;

    if (query) {
      const haystack = normalise([
        provider.displayName,
        provider.latinName,
        provider.bio,
        provider.city,
        provider.country,
        provider.providerKindLabel,
        ...provider.specialtyTags,
        ...provider.languages,
        ...provider.offerCategories.map((key) =>
          TRIP_TYPES.find((item) => item.key === key)?.label ?? key,
        ),
      ].join(" "));
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

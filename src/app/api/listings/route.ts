import { NextResponse } from "next/server";
import { getPublishedOffers } from "@/lib/data";
import {
  buildListingCategoryFacets,
  toPublicMarketplaceListing,
} from "@/lib/marketplace-listing";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function normalise(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ar-EG");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = (searchParams.get("category") ?? "").trim();
  const query = normalise((searchParams.get("q") ?? "").slice(0, 120));
  const origin = normalise((searchParams.get("from") ?? "").slice(0, 80));
  const destination = normalise((searchParams.get("to") ?? "").slice(0, 80));

  const listings = (await getPublishedOffers()).map(toPublicMarketplaceListing);
  const categories = buildListingCategoryFacets(listings);

  const filtered = listings.filter((listing) => {
    if (category && listing.category !== category) return false;
    if (origin && !normalise(listing.route.originCity).includes(origin)) return false;
    if (destination && !normalise(
      listing.route.destinationCity + " " + listing.route.destinationCountry,
    ).includes(destination)) return false;
    if (query && !normalise([
      listing.title,
      listing.description,
      listing.categoryLabel,
      listing.provider.name,
      listing.route.originCity,
      listing.route.destinationCity,
      listing.route.destinationCountry,
    ].join(" ")).includes(query)) return false;
    return true;
  });

  return NextResponse.json(
    {
      count: filtered.length,
      listings: filtered,
      categories,
      policy: {
        prices: "provider_published_and_require_confirmation",
        availability: "not_live_verified",
        booking: "not_provided_by_this_listing_endpoint",
      },
    },
    { headers: NO_STORE },
  );
}

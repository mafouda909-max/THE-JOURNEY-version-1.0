import type { MetadataRoute } from "next";
import { getAgentsWithRatings, getDestinations, getPublishedOffers } from "@/lib/data";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const staticEntries: MetadataRoute.Sitemap = [
  { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
  { url: absoluteUrl("/offers"), changeFrequency: "hourly", priority: 0.9 },
  { url: absoluteUrl("/agents"), changeFrequency: "daily", priority: 0.8 },
  { url: absoluteUrl("/destinations"), changeFrequency: "daily", priority: 0.8 },
  { url: absoluteUrl("/trust"), changeFrequency: "monthly", priority: 0.6 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const [offers, agents, destinations] = await Promise.all([
      getPublishedOffers(),
      getAgentsWithRatings(),
      getDestinations(),
    ]);

    return [
      ...staticEntries,
      ...offers.map((offer) => ({
        url: absoluteUrl(`/offers/${offer.id}`),
        lastModified: offer.publishedAt ?? offer.createdAt,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
      ...agents.map((agent) => ({
        url: absoluteUrl(`/agents/${agent.id}`),
        lastModified: agent.joinedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...destinations.map((destination) => ({
        url: absoluteUrl(`/destinations/${destination.slug}`),
        changeFrequency: "daily" as const,
        priority: 0.75,
      })),
    ];
  } catch (error) {
    console.error("sitemap.dynamic_entries_failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return staticEntries;
  }
}

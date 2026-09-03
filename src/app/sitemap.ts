import type { MetadataRoute } from "next";
import { getAgentsWithRatings, getDestinations, getPublishedOffers } from "@/lib/data";

export const dynamic = "force-dynamic";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [offers, agents, destinations] = await Promise.all([
    getPublishedOffers(),
    getAgentsWithRatings(),
    getDestinations(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/offers`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE}/agents`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/destinations`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/trust`, changeFrequency: "monthly", priority: 0.4 },
  ];

  return [
    ...staticPages,
    ...offers.map((o) => ({
      url: `${BASE}/offers/${o.id}`,
      lastModified: o.publishedAt ?? o.createdAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...agents.map((a) => ({
      url: `${BASE}/agents/${a.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...destinations.map((d) => ({
      url: `${BASE}/destinations/${d.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}

import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";
import { publicIndexingEnabled } from "@/lib/public-indexing";

export const dynamic = "force-static";

/**
 * Keep the sitemap build-safe: the public sitemap itself must not require a
 * live database connection during `next build`. Dynamic offer/agent URLs are
 * still discoverable through the app's internal links and can be added here
 * later with a runtime data source if needed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!publicIndexingEnabled) return [];

  return [
    { url: `${BRAND.siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BRAND.siteUrl}/offers`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BRAND.siteUrl}/agents`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BRAND.siteUrl}/destinations`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BRAND.siteUrl}/trust`, changeFrequency: "monthly", priority: 0.4 },
  ];
}

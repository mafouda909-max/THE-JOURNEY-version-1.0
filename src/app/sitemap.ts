import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// Public site base URL used by sitemap/robots. NEXT_PUBLIC_SITE_URL is the
// canonical name; NEXT_PUBLIC_APP_URL is honored as a legacy alias.
const BASE =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";

/**
 * Keep the sitemap build-safe: the public sitemap itself must not require a
 * live database connection during `next build`. Dynamic offer/agent URLs are
 * still discoverable through the app's internal links and can be added here
 * later with a runtime data source if needed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/offers`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE}/agents`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/destinations`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/trust`, changeFrequency: "monthly", priority: 0.4 },
  ];
}

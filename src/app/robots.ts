import type { MetadataRoute } from "next";

// Public site base URL used by sitemap/robots. NEXT_PUBLIC_SITE_URL is the
// canonical name; NEXT_PUBLIC_APP_URL is honored as a legacy alias.
const BASE =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/review", "/api/"],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}

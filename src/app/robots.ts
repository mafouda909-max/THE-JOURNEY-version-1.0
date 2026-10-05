import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";
import { publicIndexingEnabled } from "@/lib/public-indexing";

export default function robots(): MetadataRoute.Robots {
  if (!publicIndexingEnabled) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/review", "/api/"],
    },
    sitemap: `${BRAND.siteUrl}/sitemap.xml`,
  };
}

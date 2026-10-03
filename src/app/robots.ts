import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/review", "/api/"],
    },
    sitemap: `${BRAND.siteUrl}/sitemap.xml`,
  };
}

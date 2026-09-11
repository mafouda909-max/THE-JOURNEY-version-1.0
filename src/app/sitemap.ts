import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/offers"), changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/agents"), changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/destinations"), changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/trust"), changeFrequency: "monthly", priority: 0.5 },
  ];
}

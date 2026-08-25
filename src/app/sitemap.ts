import type { MetadataRoute } from "next";

/**
 * SEO-first marketplace (AD-01). Dynamic entries are read through the
 * anon server client — RLS/views apply; service-role is never used here.
 * When the data source is unavailable, static routes only (honest fallback).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/offers`, changeFrequency: "hourly", priority: 0.9 },
  ];

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const [offers, agents] = await Promise.all([
      supabase
        .from("public_offers")
        .select("id,published_at")
        .order("published_at", { ascending: false })
        .limit(2000),
      supabase.from("public_agent_profiles").select("id").limit(1000),
    ]);

    return [
      ...staticEntries,
      ...(offers.data ?? []).map((o) => ({
        url: `${base}/offers/${o.id}`,
        lastModified: o.published_at ? new Date(o.published_at) : undefined,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
      ...(agents.data ?? []).map((a) => ({
        url: `${base}/agents/${a.id}`,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    return staticEntries;
  }
}

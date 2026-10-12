import "server-only";

import { resolvePublicOffersSource } from "./offers";
import type { PublicAgentProfileRow, PublicOfferRow } from "./types";

/**
 * Demo-preview source switch (AD-17 deviation #8) — mirrors
 * resolvePublicOffersSource() in offers.ts. Hard production guard:
 * production builds ALWAYS read the canonical `public_agent_profiles`
 * view regardless of any environment value. The staging-only
 * `public_agent_profiles_staging` projection (is_demo = true rows only)
 * activates solely in non-production builds with NEXT_PUBLIC_DEMO_PREVIEW=true.
 * (Intentionally duplicated rather than shared: this file is server-only,
 * offers.ts is client-safe — keeping the two seams independent.)
 */
function resolvePublicAgentProfilesSource(): string {
  if (process.env.NODE_ENV === "production") return "public_agent_profiles";
  return process.env.NEXT_PUBLIC_DEMO_PREVIEW === "true"
    ? "public_agent_profiles_staging"
    : "public_agent_profiles";
}

/**
 * Server-side reads for RSC detail/profile pages — anon key + cookies client
 * (never service-role; AD-05/AD-14). All authorization via RLS/views.
 */

async function serverClient() {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    return await createClient();
  } catch {
    throw new (await import("./types")).DataSourceUnavailableError();
  }
}

export async function getPublicOfferServer(
  id: string,
): Promise<PublicOfferRow | null> {
  const supabase = await serverClient();
  const { data, error } = await supabase
    .from(resolvePublicOffersSource())
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as PublicOfferRow) ?? null;
}

export async function getPublicAgentServer(
  id: string,
): Promise<PublicAgentProfileRow | null> {
  const supabase = await serverClient();
  const { data, error } = await supabase
    .from(resolvePublicAgentProfilesSource())
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as PublicAgentProfileRow) ?? null;
}

export async function listAgentPublicOffersServer(
  agentId: string,
): Promise<PublicOfferRow[]> {
  const supabase = await serverClient();
  const { data, error } = await supabase
    .from(resolvePublicOffersSource())
    .select("*")
    .eq("agent_id", agentId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(24);
  if (error) throw error;
  return (data ?? []) as PublicOfferRow[];
}

/** Home-page featured offers (newest published, view-guaranteed verified). */
export async function listFeaturedOffersServer(
  limit = 6,
): Promise<PublicOfferRow[]> {
  const supabase = await serverClient();
  const { data, error } = await supabase
    .from(resolvePublicOffersSource())
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PublicOfferRow[];
}

/** Trust-stats strip (home). Counts may be null while source unavailable. */
export async function getDiscoveryStatsServer(): Promise<{
  agents: number | null;
  offers: number | null;
  cities: number | null;
}> {
  const supabase = await serverClient();
  const [o, a, c] = await Promise.all([
    supabase.from(resolvePublicOffersSource()).select("id", { count: "exact", head: true }),
    supabase
      .from(resolvePublicAgentProfilesSource())
      .select("id", { count: "exact", head: true }),
    supabase.from("cities").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);
  return { offers: o.count ?? null, agents: a.count ?? null, cities: c.count ?? null };
}

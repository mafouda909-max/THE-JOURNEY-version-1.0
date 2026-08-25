import "server-only";

import type { PublicAgentProfileRow, PublicOfferRow } from "./types";

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
    .from("public_offers")
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
    .from("public_agent_profiles")
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
    .from("public_offers")
    .select("*")
    .eq("agent_id", agentId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(24);
  if (error) throw error;
  return (data ?? []) as PublicOfferRow[];
}

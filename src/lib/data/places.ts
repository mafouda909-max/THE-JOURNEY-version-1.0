import type { PlaceOption } from "@/lib/search/places-fallback";

/**
 * Browser-side autocomplete source — search_places RPC (AD-11), anon only.
 * Injected into CityAutocomplete as `fetcher` (Phase C wiring).
 */
export async function searchPlaces(q: string): Promise<PlaceOption[]> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data, error } = await supabase.rpc("search_places", { q });
  if (error) throw error;
  return (data ?? []).map(
    (r: {
      id: string;
      slug: string | null;
      name_ar: string;
      name_en: string;
      country_ar: string | null;
      kind: string;
      iata: string | null;
    }) => ({
      id: r.id,
      slug: r.slug ?? undefined,
      name_ar: r.name_ar,
      name_en: r.name_en,
      country_ar: r.country_ar ?? "",
      kind: r.kind === "airport" ? ("airport" as const) : ("city" as const),
      iata: r.iata ?? undefined,
    }),
  );
}

/** Resolve a filter ref (uuid or slug) → Arabic display label for chips. */
const labelCache = new Map<string, string>();

export async function resolveCityLabel(ref: string): Promise<string> {
  const hit = labelCache.get(ref);
  if (hit) return hit;

  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const isUuid = /^[0-9a-f-]{36}$/i.test(ref);
    const column = isUuid ? "id" : "slug";
    const { data } = await supabase
      .from("cities")
      .select("name_ar")
      .eq(column, ref)
      .maybeSingle();
    const label = data?.name_ar ?? ref;
    labelCache.set(ref, label);
    return label;
  } catch {
    return ref; // honest fallback while unavailable
  }
}

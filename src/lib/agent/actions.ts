"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Agent portal server actions. Every action re-resolves the session and the
 * owning agent profile server-side (Decision 5); mutations flow through the
 * ratified SECURITY DEFINER lifecycle RPCs — never raw status updates.
 */

const NL = String.fromCharCode(10);

function lines(formData: FormData, key: string): string[] {
  return String(formData.get(key) ?? "")
    .split(NL)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function agentContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) redirect("/login?next=/dashboard");

  const { data: profile } = await supabase
    .from("agent_profiles")
    .select("id")
    .eq("user_id", uid)
    .maybeSingle();
  if (!profile) redirect("/agents/register");
  return { supabase, uid, agentId: profile.id as string };
}
/** Create a DRAFT offer from the wizard (RLS: own draft only). */
export async function createDraftOfferAction(formData: FormData): Promise<void> {
  const { supabase, agentId } = await agentContext();

  const s = (k: string): string | null => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const n = (k: string): number | null =>
    formData.get(k) ? Number(formData.get(k)) : null;

  const payload = {
    agent_id: agentId, // RLS WITH CHECK: agent_id = current_agent_profile_id()
    title_ar: s("title_ar")!,
    title_en: s("title_en"),
    description_ar: s("description_ar")!,
    description_en: s("description_en"),
    trip_type: s("trip_type") ?? "flight",
    route_type: s("route_type"),
    origin_city_id: s("origin_city_id")!,
    destination_city_id: s("destination_city_id")!,
    origin_airport_id: s("origin_airport_id"),
    destination_airport_id: s("destination_airport_id"),
    airline_id: s("airline_id"),
    departure_date: s("departure_date"),
    return_date: s("return_date"),
    duration_days: n("duration_days"),
    flexible_dates: formData.get("flexible_dates") === "on",
    price_amount: Number(formData.get("price_amount")),
    currency: s("currency") ?? "SAR",
    price_type: s("price_type") ?? "fixed",
    price_basis: s("price_basis") ?? "per_person",
    includes: lines(formData, "includes"),
    excludes: lines(formData, "excludes"),
    min_travelers: Number(formData.get("min_travelers") ?? 1),
    max_travelers: n("max_travelers"),
    valid_from: new Date().toISOString(),
    valid_until:
      s("valid_until") ??
      new Date(Date.now() + 30 * 86_400_000).toISOString(),
    is_demo: false,
  };

  const { data, error } = await supabase
    .from("offers")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    redirect(`/dashboard/offers/new?e=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/dashboard/offers");
  redirect(`/dashboard/offers/${data!.id}/edit?created=1`);
}

/** T1 — draft → pending_review (verified agents only; server-side rules). */
export async function submitOfferAction(formData: FormData): Promise<void> {
  const { supabase } = await agentContext();
  const id = String(formData.get("offer_id") ?? "");
  const { error } = await supabase.rpc("submit_own_offer", { p_offer_id: id });
  if (error) {
    redirect(`/dashboard/offers/${id}/edit?e=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/dashboard/offers");
  redirect("/dashboard/offers?s=submitted");
}

/** T7/T7b — archive (owner path; terminal). */
export async function archiveOfferAction(formData: FormData): Promise<void> {
  const { supabase } = await agentContext();
  const id = String(formData.get("offer_id") ?? "");
  const { error } = await supabase.rpc("archive_offer", { p_offer_id: id });
  if (error) {
    redirect(`/dashboard/offers/${id}/edit?e=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/dashboard/offers");
  redirect("/dashboard/offers?s=archived");
}

/** T4/T6 — rejected|expired → pending_review (+ optional renewal validity). */
export async function resubmitOfferAction(formData: FormData): Promise<void> {
  const { supabase } = await agentContext();
  const id = String(formData.get("offer_id") ?? "");
  const nvu = String(formData.get("new_valid_until") ?? "");
  const { error } = await supabase.rpc("resubmit_own_offer", {
    p_offer_id: id,
    p_new_valid_until: nvu ? new Date(nvu).toISOString() : null,
  });
  if (error) {
    redirect(`/dashboard/offers/${id}/edit?e=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/dashboard/offers");
  redirect("/dashboard/offers?s=resubmitted");
}

/** Pre-publication content patch (draft/rejected/expired). */
export async function prepublicationPatchAction(formData: FormData): Promise<void> {
  const { supabase } = await agentContext();
  const id = String(formData.get("offer_id") ?? "");
  const s = (k: string): string | null => {
    const v = String(formData.get(k) ?? "");
    return v === "" ? null : v;
  };
  const n = (k: string): number | null =>
    formData.get(k) ? Number(formData.get(k)) : null;

  const { error } = await supabase.rpc("update_own_offer_prepublication", {
    p_offer_id: id,
    p_title_ar: s("title_ar"),
    p_title_en: s("title_en"),
    p_description_ar: s("description_ar"),
    p_description_en: s("description_en"),
    p_trip_type: s("trip_type"),
    p_route_type: s("route_type"),
    p_origin_city_id: s("origin_city_id"),
    p_destination_city_id: s("destination_city_id"),
    p_origin_airport_id: s("origin_airport_id"),
    p_destination_airport_id: s("destination_airport_id"),
    p_airline_id: s("airline_id"),
    p_departure_date: s("departure_date"),
    p_return_date: s("return_date"),
    p_duration_days: n("duration_days"),
    p_flexible_dates: formData.get("flexible_dates") === "on",
    p_price_amount: formData.get("price_amount")
      ? Number(formData.get("price_amount"))
      : null,
    p_currency: s("currency"),
    p_price_type: s("price_type"),
    p_price_basis: s("price_basis"),
    p_includes: lines(formData, "includes"),
    p_excludes: lines(formData, "excludes"),
    p_min_travelers: formData.get("min_travelers")
      ? Number(formData.get("min_travelers"))
      : null,
    p_max_travelers: n("max_travelers"),
    p_valid_from: s("valid_from"),
    p_valid_until: s("valid_until"),
  });
  if (error) {
    redirect(`/dashboard/offers/${id}/edit?e=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/dashboard/offers/${id}/edit`);
  redirect(`/dashboard/offers/${id}/edit?s=saved`);
}

/** E1 — minor edit on PUBLISHED offers (descriptions/includes/excludes). */
export async function minorEditAction(formData: FormData): Promise<void> {
  const { supabase } = await agentContext();
  const id = String(formData.get("offer_id") ?? "");

  const { error } = await supabase.rpc("update_own_offer_minor", {
    p_offer_id: id,
    p_description_ar: String(formData.get("description_ar") ?? "").trim() || null,
    p_description_en: String(formData.get("description_en") ?? "").trim() || null,
    p_includes: lines(formData, "includes"),
    p_excludes: lines(formData, "excludes"),
  });
  if (error) {
    redirect(`/dashboard/offers/${id}/edit?e=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/dashboard/offers/${id}/edit`);
  redirect(`/dashboard/offers/${id}/edit?s=minor_saved`);
}

/** E2 — major edit: atomic published→pending_review + Q2 snapshot. */
export async function majorEditAction(formData: FormData): Promise<void> {
  const { supabase } = await agentContext();
  const id = String(formData.get("offer_id") ?? "");
  const s = (k: string): string | null => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const n = (k: string): number | null =>
    formData.get(k) ? Number(formData.get(k)) : null;

  const { error } = await supabase.rpc("submit_offer_major_edit", {
    p_offer_id: id,
    p_price_amount: formData.get("price_amount")
      ? Number(formData.get("price_amount"))
      : null,
    p_currency: s("currency"),
    p_price_type: s("price_type"),
    p_price_basis: s("price_basis"),
    p_origin_city_id: s("origin_city_id"),
    p_destination_city_id: s("destination_city_id"),
    p_origin_airport_id: s("origin_airport_id"),
    p_destination_airport_id: s("destination_airport_id"),
    p_airline_id: s("airline_id"),
    p_route_type: s("route_type"),
    p_departure_date: s("departure_date"),
    p_return_date: s("return_date"),
    p_duration_days: n("duration_days"),
    p_flexible_dates: formData.get("flexible_dates") === "on",
    p_valid_from: s("valid_from"),
    p_valid_until: s("valid_until"),
  });
  if (error) {
    redirect(`/dashboard/offers/${id}/edit?e=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/dashboard/offers");
  redirect("/dashboard/offers?s=major_submitted");
}

/** §3.2 profile content columns (column-level UPDATE grant via RLS). */
export async function saveProfileAction(formData: FormData): Promise<void> {
  const { supabase, uid } = await agentContext();

  const { error } = await supabase
    .from("agent_profiles")
    .update({
      display_name: String(formData.get("display_name") ?? "").trim(),
      business_name: String(formData.get("business_name") ?? "").trim() || null,
      bio_ar: String(formData.get("bio_ar") ?? "").trim() || null,
      bio_en: String(formData.get("bio_en") ?? "").trim() || null,
      photo_url: String(formData.get("photo_url") ?? "").trim() || null,
      city_id: String(formData.get("city_id") ?? "") || null,
      license_type:
        String(formData.get("license_type") ?? "individual") === "agency"
          ? "agency"
          : "individual",
      license_number: String(formData.get("license_number") ?? "").trim() || null,
      specialty_tags: lines(formData, "specialty_tags"),
      languages_spoken: ["ar"],
    })
    .eq("user_id", uid);

  if (error) {
    redirect(`/dashboard/profile?e=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/dashboard/profile");
  redirect("/dashboard/profile?s=saved");
}

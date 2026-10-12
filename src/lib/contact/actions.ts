"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAgent, requireTraveler } from "@/lib/auth/guards";
import { mapContactError } from "./errors";
import { safeLocalPath } from "@/lib/navigation";

/**
 * CONTACT server actions (Slice 3). Every mutation flows through the ratified
 * SECURITY DEFINER lifecycle RPCs — the participant-only RLS on
 * contact_requests has no INSERT/UPDATE path for clients. Traveler actions
 * require a traveler session; agent actions require an agent profile.
 */

function back(offerId: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `/offers/${offerId}${qs ? `?${qs}` : ""}`;
}

export async function createContactRequestAction(formData: FormData): Promise<void> {
  const offerId = String(formData.get("offer_id") ?? "");
  const { supabase } = await requireTraveler(`/offers/${offerId}`);

  const message = String(formData.get("message") ?? "");
  const countRaw = String(formData.get("traveler_count") ?? "1");
  const dates = String(formData.get("travel_dates_note") ?? "").trim();
  const travelerCount = Number(countRaw) > 0 ? Math.floor(Number(countRaw)) : 1;

  const { error } = await supabase.rpc("create_contact_request", {
    p_offer_id: offerId,
    p_message: message,
    p_traveler_count: travelerCount,
    p_travel_dates_note: dates === "" ? null : dates,
  });

  if (error) {
    redirect(back(offerId, { ce: mapContactError(error.message) }));
  }
  revalidatePath(`/offers/${offerId}`);
  redirect(back(offerId, { cs: "created" }));
}

export async function cancelContactRequestAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get("request_id") ?? "");
  const offerId = String(formData.get("offer_id") ?? "");
  await requireTraveler(`/offers/${offerId}`);
  const supabase = await createClient();

  const { error } = await supabase.rpc("cancel_contact", { p_request_id: requestId });
  if (error) {
    redirect(back(offerId, { ce: mapContactError(error.message) }));
  }
  revalidatePath(`/offers/${offerId}`);
  redirect(back(offerId, { cs: "cancelled" }));
}

export async function closeContactRequestAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get("request_id") ?? "");
  const offerId = String(formData.get("offer_id") ?? "");
  await requireTraveler(`/offers/${offerId}`);
  const supabase = await createClient();

  const { error } = await supabase.rpc("close_contact", { p_request_id: requestId });
  if (error) {
    redirect(back(offerId, { ce: mapContactError(error.message) }));
  }
  revalidatePath(`/offers/${offerId}`);
  redirect(back(offerId, { cs: "closed" }));
}

/** Agent opens the detail — idempotent NEW→VIEWED marking (B7: never consults offer state). */
export async function markContactViewedAction(requestId: string): Promise<void> {
  const { supabase } = await requireAgent();
  await supabase.rpc("mark_contact_viewed", { p_request_id: requestId });
  // Idempotent by contract — a foreign id or already-viewed row is a no-op.
  revalidatePath(`/dashboard/contacts/${requestId}`);
}

export async function respondToContactAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get("request_id") ?? "");
  const nextPath = safeLocalPath(String(formData.get("back_to") ?? ""), `/dashboard/contacts/${requestId}`);
  await requireAgent();
  const supabase = await createClient();

  const response = String(formData.get("response_message") ?? "").trim();
  const { error } = await supabase.rpc("respond_to_contact", {
    p_request_id: requestId,
    p_response: response,
  });

  if (error) {
    redirect(`${nextPath}${nextPath.includes("?") ? "&" : "?"}e=${encodeURIComponent(mapContactError(error.message))}`);
  }
  revalidatePath("/dashboard/contacts");
  revalidatePath(nextPath);
  redirect(`${nextPath}${nextPath.includes("?") ? "&" : "?"}s=responded`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminMfa } from "@/lib/auth/guards";

/**
 * ADMIN server actions — gated by requireAdminMfa() (session role=admin +
 * AAL2). Lifecycle RPCs re-verify is_admin() inside the database; the
 * service-role client is used ONLY for private-bucket signed URLs (AD-06).
 */

async function adminContext() {
  const { supabase } = await requireAdminMfa();
  return supabase;
}

export async function decideVerificationAction(formData: FormData): Promise<void> {
  const supabase = await adminContext();
  const requestId = String(formData.get("request_id") ?? "");
  const approved = formData.get("approved") === "true";
  const note = String(formData.get("note") ?? "").trim();

  if (!approved && note.length === 0) {
    redirect(`/admin/agents?e=${encodeURIComponent("سبب القرار مطلوب عند الرفض")}`);
  }

  const { error } = await supabase.rpc("admin_decide_verification", {
    p_request_id: requestId,
    p_approved: approved,
    p_note: approved && note.length === 0 ? null : note,
  });
  if (error) redirect(`/admin/agents?e=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/agents");
  redirect("/admin/agents?s=decided");
}

export async function suspendAgentAction(formData: FormData): Promise<void> {
  const supabase = await adminContext();
  const agentId = String(formData.get("agent_id") ?? "");
  const suspended = formData.get("suspended") === "true";
  const reason = String(formData.get("reason") ?? "").trim() || null;

  const { error } = await supabase.rpc("admin_set_agent_suspension", {
    p_agent_id: agentId,
    p_suspended: suspended,
    p_reason: reason,
  });
  if (error) redirect(`/admin/agents?e=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/agents");
  redirect("/admin/agents?s=suspension");
}

export async function approveOfferAction(formData: FormData): Promise<void> {
  const supabase = await adminContext();
  const offerId = String(formData.get("offer_id") ?? "");
  const { error } = await supabase.rpc("admin_approve_offer", { p_offer_id: offerId });
  if (error) redirect(`/admin/offers/${offerId}?e=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/offers");
  redirect("/admin/offers?s=approved");
}

export async function rejectOfferAction(formData: FormData): Promise<void> {
  const supabase = await adminContext();
  const offerId = String(formData.get("offer_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length === 0) {
    redirect(`/admin/offers/${offerId}?e=${encodeURIComponent("سبب الرفض مطلوب")}`);
  }
  const { error } = await supabase.rpc("admin_reject_offer", {
    p_offer_id: offerId,
    p_reason: reason,
  });
  if (error) redirect(`/admin/offers/${offerId}?e=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/offers");
  redirect("/admin/offers?s=rejected");
}

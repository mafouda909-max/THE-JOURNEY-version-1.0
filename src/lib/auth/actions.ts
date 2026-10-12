"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeLocalPath } from "@/lib/navigation";

/**
 * Auth server actions — the ONLY place auth credentials touch the app.
 * Role promotion to admin is impossible through signup (whitelist mirror in
 * trg_handle_new_user); admin status is provisioned out-of-band.
 */

function origin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    `http://localhost:${process.env.PORT ?? "3000"}`
  );
}

export async function signInAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeLocalPath(String(formData.get("next") ?? ""), "/dashboard");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?e=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function signUpTravelerAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin()}/auth/confirm?next=/dashboard`,
      data: { role: "traveler", display_name: displayName, language: "ar" },
    },
  });
  if (error) redirect(`/register?e=${encodeURIComponent(error.message)}`);

  // Email confirmation on → session is null until confirmed:
  if (!data.session) redirect("/verify-email");
  redirect("/dashboard");
}

export async function signUpAgentAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const businessName = String(formData.get("business_name") ?? "").trim();
  const bioAr = String(formData.get("bio_ar") ?? "").trim();
  const cityId = String(formData.get("city_id") ?? "");
  const licenseType = String(formData.get("license_type") ?? "individual");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin()}/auth/confirm?next=/dashboard/verification`,
      data: { role: "agent", display_name: displayName, language: "ar" },
    },
  });
  if (error) redirect(`/agents/register?e=${encodeURIComponent(error.message)}&step=account`);

  if (!data.user) redirect("/verify-email");

  // Profile basics (§4.3 Step 1). Insert via RLS once the row exists;
  // the mirror trigger creates public.users on the auth insert above.
  if (data.session) {
    await supabase.from("agent_profiles").insert({
      user_id: data.user.id,
      display_name: displayName || email.split("@")[0],
      business_name: businessName || null,
      bio_ar: bioAr || null,
      city_id: cityId || null,
      license_type: licenseType === "agency" ? "agency" : "individual",
    });
    redirect("/dashboard/verification");
  }
  redirect("/verify-email");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordResetAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin()}/auth/confirm?next=/forgot-password`,
  });
  // Honest neutral state regardless of account existence (no enumeration):
  redirect("/forgot-password?sent=1");
}

/** Admin MFA — challenge + verify an enrolled TOTP factor (AAL2). */
export async function adminMfaVerifyAction(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  const supabase = await createClient();

  const { data: factors } = await supabase.auth.mfa.listFactors();
  // Multiple factors can exist over time — always challenge the LATEST
  // (friendlyName carries the enrollment timestamp).
  const totp = (factors?.totp ?? [])
    .filter((f) => f.status === "verified")
    .sort((a, b) => (b.friendly_name ?? "").localeCompare(a.friendly_name ?? ""))[0];
  if (!totp) redirect("/admin/login?mfa=enroll");

  const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({
    factorId: totp.id,
  });
  if (cErr) redirect("/admin/login?mfa=required&e=" + encodeURIComponent(cErr.message));

  const { error: vErr } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: challenge!.id,
    code,
  });
  if (vErr) redirect(`/admin/login?mfa=required&e=${encodeURIComponent(vErr.message)}`);
  redirect("/admin/dashboard");
}

/**
 * First-time admin MFA enrollment: creates the TOTP factor and hands back its
 * secret so it can be added to an authenticator. Staging-only convenience:
 * the secret round-trips via the callback URL on this internal screen.
 */
export async function adminMfaEnrollAction(): Promise<void> {
  const supabase = await createClient();
  // Keep exactly ONE verified factor: drop stale ones first so the freshly
  // enrolled secret is always the single challenge target (E2E determinism
  // and simpler recovery for real admins).
  const { data: existingFactors } = await supabase.auth.mfa.listFactors();
  for (const f of existingFactors?.totp ?? []) {
    try {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    } catch {
      /* best-effort cleanup */
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    // Unique per attempt: GoTrue rejects duplicate friendly names.
    friendlyName: `admin-${Date.now()}`,
  });  if (error || !data?.totp) {
    redirect(`/admin/login?mfa=enroll&e=${encodeURIComponent(error?.message ?? "enroll failed")}`);
  }
  redirect(
    `/admin/login?mfa=enroll&factor=${encodeURIComponent(data.id)}&secret=${encodeURIComponent(data.totp.secret)}`,
  );
}

export async function adminMfaEnrollVerifyAction(formData: FormData): Promise<void> {
  const factorId = String(formData.get("factor") ?? "");
  const secret = String(formData.get("secret") ?? "");
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  const supabase = await createClient();

  const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
  if (cErr) redirect(`/admin/login?mfa=enroll&e=${encodeURIComponent(cErr.message)}`);

  const { error: vErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge!.id,
    code,
  });
  if (vErr) {
    // Wrong code → retry with the same factor/secret still on screen.
    redirect(
      `/admin/login?mfa=enroll&factor=${encodeURIComponent(factorId)}&secret=${encodeURIComponent(secret)}&e=${encodeURIComponent(vErr.message)}`,
    );
  }
  redirect("/admin/dashboard");
}

import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side auth guards (Decision 5). Every protected layout/page/server
 * action resolves its session HERE — the client never asserts roles, and
 * service-role credentials never leave `admin.ts`.
 */

export interface SessionUser {
  id: string;
  email: string | undefined;
  /** App role from public.users — authoritative, RLS-scoped to own row. */
  role: "traveler" | "agent" | "admin";
}

async function getSession(): Promise<{
  user: SessionUser | null;
  supabase: Awaited<ReturnType<typeof createClient>>;
}> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { user: null, supabase };

  const { data: row } = await supabase
    .from("users")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      role: (row?.role as SessionUser["role"]) ?? "traveler",
    },
    supabase,
  };
}

/** Non-redirecting session peek — for pages that adapt to auth state. */
export async function getSessionUser(): Promise<SessionUser | null> {
  return (await getSession()).user;
}

/** Any authenticated user; otherwise redirect to /login with a return path. */
export async function requireUser(next = "/dashboard"): Promise<{
  user: SessionUser;
  supabase: Awaited<ReturnType<typeof createClient>>;
}> {
  const { user, supabase } = await getSession();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { user, supabase };
}

/**
 * Authenticated TRAVELER — roles are exclusive in V1 (DATABASE_DESIGN):
 * agents/admins are redirected home and can never act as travelers.
 */
export async function requireTraveler(next = "/"): Promise<{
  user: SessionUser;
  supabase: Awaited<ReturnType<typeof createClient>>;
}> {
  const { user, supabase } = await requireUser(next);
  if (user.role !== "traveler") redirect("/");
  return { user, supabase };
}

/** Authenticated agent (role from the DB mirror — never client state). */
export async function requireAgent(): Promise<{
  user: SessionUser;
  agentProfileId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}> {
  const { user, supabase } = await requireUser("/agents/register");
  if (user.role !== "agent") redirect("/");

  const { data: profile } = await supabase
    .from("agent_profiles")
    .select("id, verification_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) redirect("/agents/register?step=profile");
  return { user, agentProfileId: profile.id, supabase };
}

/**
 * Authenticated ADMIN + mandatory MFA (AAL2). AD-14: the admin portal refuses
 * sessions lacking an MFA-verified factor.
 */
export async function requireAdminMfa(): Promise<{
  user: SessionUser;
  supabase: Awaited<ReturnType<typeof createClient>>;
}> {
  const { user, supabase } = await requireUser("/admin/login");
  if (user.role !== "admin") redirect("/");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") {
    // Route to the MFA challenge step of the admin login flow.
    redirect("/admin/login?mfa=required");
  }
  return { user, supabase };
}

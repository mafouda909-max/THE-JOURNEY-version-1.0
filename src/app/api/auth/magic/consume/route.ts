import { NextResponse } from "next/server";
import { resolveAuthOrigin } from "@/lib/auth-origin";
import { createSession, sessionCookie } from "@/lib/identity";
import { trackEvent } from "@/lib/data";
import {
  consumeMagicChallenge,
  normalizeSelfServeRole,
  postAuthDestination,
  provisionVerifiedIdentity,
} from "@/lib/passwordless-auth";

export const dynamic = "force-dynamic";

function fail(request: Request, code: string) {
  const origin = resolveAuthOrigin(request.url) ?? new URL(request.url).origin;
  return NextResponse.redirect(
    new URL(`/join?error=${encodeURIComponent(code)}`, origin),
  );
}

export async function GET(request: Request) {
  if (process.env.MAGIC_LINK_ENABLED !== "true") return fail(request, "magic_link_not_configured");
  const origin = resolveAuthOrigin(request.url);
  if (!origin) return fail(request, "magic_link_not_configured");
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!/^[A-Za-z0-9_-]{32,160}$/.test(token)) return fail(request, "magic_link_invalid");

  const challenge = await consumeMagicChallenge(token);
  if (!challenge) return fail(request, "magic_link_expired_or_used");

  const role = normalizeSelfServeRole(challenge.requestedRole);
  if (!role) return fail(request, "magic_link_role_invalid");

  const provisioned = await provisionVerifiedIdentity({
    provider: "email",
    providerSubject: challenge.email,
    email: challenge.email,
    displayName: challenge.displayName,
    requestedRole: role,
    intent: challenge.intent === "signup" ? "signup" : "login",
    city: challenge.city,
  });
  if (!provisioned.ok) return fail(request, provisioned.code.toLowerCase());

  if (challenge.intent === "signup" && role === "agent") {
    await trackEvent("agent_identity_provisioned", {
      meta: JSON.stringify({ provider: "magic" }),
    });
  }

  const sessionToken = await createSession(provisioned.account.id);
  const response = NextResponse.redirect(
    new URL(postAuthDestination(provisioned.account.role), origin),
  );
  const session = sessionCookie(sessionToken);
  response.cookies.set(session.name, session.value, session);
  return response;
}

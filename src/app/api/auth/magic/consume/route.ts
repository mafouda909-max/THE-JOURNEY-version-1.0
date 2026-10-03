import { NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";
import { createSession, sessionCookie } from "@/lib/identity";
import {
  consumeMagicChallenge,
  normalizeSelfServeRole,
  postAuthDestination,
  provisionVerifiedIdentity,
} from "@/lib/passwordless-auth";

export const dynamic = "force-dynamic";

function baseUrl(request: Request): string {
  if (BRAND.siteUrl !== "http://localhost:3000") return BRAND.siteUrl;
  return new URL(request.url).origin;
}

function fail(request: Request, code: string) {
  return NextResponse.redirect(
    new URL(`/join?error=${encodeURIComponent(code)}`, baseUrl(request)),
  );
}

export async function GET(request: Request) {
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

  const sessionToken = await createSession(provisioned.account.id);
  const response = NextResponse.redirect(
    new URL(postAuthDestination(provisioned.account.role), baseUrl(request)),
  );
  const session = sessionCookie(sessionToken);
  response.cookies.set(session.name, session.value, session);
  return response;
}

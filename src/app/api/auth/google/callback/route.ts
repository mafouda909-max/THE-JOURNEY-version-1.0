import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";
import { resolveAuthOrigin } from "@/lib/auth-origin";
import { createSession, sessionCookie } from "@/lib/identity";
import {
  normalizeAuthIntent,
  normalizeSelfServeRole,
  postAuthDestination,
  provisionVerifiedIdentity,
} from "@/lib/passwordless-auth";

export const dynamic = "force-dynamic";

const COOKIE = {
  state: "sila_google_state",
  verifier: "sila_google_verifier",
  role: "sila_google_role",
  intent: "sila_google_intent",
} as const;

function cookieValue(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie") ?? "";
  const match = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function clearOauthCookies(response: NextResponse) {
  for (const name of Object.values(COOKIE)) {
    response.cookies.set(name, "", { maxAge: 0, path: "/" });
  }
}

function failure(request: Request, code: string, origin = resolveAuthOrigin(request.url) ?? new URL(request.url).origin) {
  const response = NextResponse.redirect(new URL(`/join?error=${encodeURIComponent(code)}`, origin));
  clearOauthCookies(response);
  return response;
}

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const origin = resolveAuthOrigin(request.url);
  if (!clientId || !clientSecret || !origin) return failure(request, "google_not_configured");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = cookieValue(request, COOKIE.state);
  const verifier = cookieValue(request, COOKIE.verifier);
  const requestedRole = normalizeSelfServeRole(cookieValue(request, COOKIE.role)) ?? "traveler";
  const intent = normalizeAuthIntent(cookieValue(request, COOKIE.intent));

  if (!code || !state || !expectedState || !verifier || !safeEqual(state, expectedState)) {
    return failure(request, "google_state_invalid");
  }

  const redirectUri = `${origin}/api/auth/google/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    cache: "no-store",
  });

  if (!tokenResponse.ok) return failure(request, "google_token_exchange_failed");
  const tokenJson = await tokenResponse.json() as { access_token?: string };
  if (!tokenJson.access_token) return failure(request, "google_token_missing");

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    cache: "no-store",
  });
  if (!profileResponse.ok) return failure(request, "google_profile_failed");

  const profile = await profileResponse.json() as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  if (!profile.sub || !profile.email || profile.email_verified !== true) {
    return failure(request, "google_email_not_verified");
  }

  const provisioned = await provisionVerifiedIdentity({
    provider: "google",
    providerSubject: profile.sub,
    email: profile.email,
    displayName: profile.name ?? null,
    requestedRole,
    intent,
  });
  if (!provisioned.ok) return failure(request, provisioned.code.toLowerCase());

  const token = await createSession(provisioned.account.id);
  const response = NextResponse.redirect(
    new URL(postAuthDestination(provisioned.account.role), origin),
  );
  const session = sessionCookie(token);
  response.cookies.set(session.name, session.value, session);
  clearOauthCookies(response);
  return response;
}

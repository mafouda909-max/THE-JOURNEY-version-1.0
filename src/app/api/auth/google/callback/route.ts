import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveAuthOrigin, resolveAuthOriginForRequest } from "@/lib/auth-origin";
import { SITE_ORIGIN } from "@/lib/site";
import { createSession, sessionCookie } from "@/lib/identity";
import { trackEvent } from "@/lib/data";
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
  try {
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

async function googleJson(url: string, options: RequestInit): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(url, {
      ...options,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    // Provider errors, tokens and response bodies never enter logs or redirects.
    return null;
  }
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
  response.headers.set("Cache-Control", "private, no-store");
  clearOauthCookies(response);
  return response;
}

export async function GET(request: Request) {
  if (process.env.GOOGLE_AUTH_ENABLED !== "true") return failure(request, "google_not_configured");
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const origin = resolveAuthOriginForRequest(request.url, SITE_ORIGIN);
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
  const tokenJson = await googleJson("https://oauth2.googleapis.com/token", {
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
  });

  if (!tokenJson) return failure(request, "google_token_exchange_failed");
  if (typeof tokenJson.access_token !== "string" || !tokenJson.access_token) {
    return failure(request, "google_token_missing");
  }

  const profile = await googleJson("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!profile) return failure(request, "google_profile_failed");
  if (typeof profile.sub !== "string" || !profile.sub || profile.sub.length > 255 ||
      typeof profile.email !== "string" || !profile.email || profile.email_verified !== true) {
    return failure(request, "google_email_not_verified");
  }

  const provisioned = await provisionVerifiedIdentity({
    provider: "google",
    providerSubject: profile.sub,
    email: profile.email,
    displayName: typeof profile.name === "string" ? profile.name : null,
    requestedRole,
    intent,
  });
  if (!provisioned.ok) return failure(request, provisioned.code.toLowerCase());

  if (intent === "signup" && requestedRole === "agent") {
    await trackEvent("agent_identity_provisioned", {
      meta: JSON.stringify({ provider: "google" }),
    });
  }

  const token = await createSession(provisioned.account.id);
  const response = NextResponse.redirect(
    new URL(postAuthDestination(provisioned.account.role), origin),
  );
  response.headers.set("Cache-Control", "private, no-store");
  const session = sessionCookie(token);
  response.cookies.set(session.name, session.value, session);
  clearOauthCookies(response);
  return response;
}

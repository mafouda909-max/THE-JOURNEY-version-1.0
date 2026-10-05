import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveAuthOriginForRequest } from "@/lib/auth-origin";
import { SITE_ORIGIN } from "@/lib/site";
import { normalizeAuthIntent, normalizeSelfServeRole } from "@/lib/passwordless-auth";
import { trackEvent } from "@/lib/data";

export const dynamic = "force-dynamic";

const COOKIE = {
  state: "sila_google_state",
  verifier: "sila_google_verifier",
  role: "sila_google_role",
  intent: "sila_google_intent",
} as const;

function tempCookie() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  };
}

export async function GET(request: Request) {
  if (process.env.GOOGLE_AUTH_ENABLED !== "true") {
    return NextResponse.redirect(new URL("/join?error=google_not_configured", new URL(request.url).origin));
  }
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const origin = resolveAuthOriginForRequest(request.url, SITE_ORIGIN);
  if (!clientId || !clientSecret || !origin) {
    const fallback = process.env.NODE_ENV === "production" ? new URL(request.url).origin : origin ?? new URL(request.url).origin;
    return NextResponse.redirect(new URL("/join?error=google_not_configured", fallback));
  }

  const url = new URL(request.url);
  const role = normalizeSelfServeRole(url.searchParams.get("role")) ?? "traveler";
  const intent = normalizeAuthIntent(url.searchParams.get("intent"));
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const redirectUri = `${origin}/api/auth/google/callback`;

  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.searchParams.set("client_id", clientId);
  google.searchParams.set("redirect_uri", redirectUri);
  google.searchParams.set("response_type", "code");
  google.searchParams.set("scope", "openid email profile");
  google.searchParams.set("state", state);
  google.searchParams.set("code_challenge", challenge);
  google.searchParams.set("code_challenge_method", "S256");
  google.searchParams.set("prompt", "select_account");

  if (intent === "signup" && role === "agent") {
    await trackEvent("agent_auth_started", {
      meta: JSON.stringify({ provider: "google" }),
    });
  }

  const response = NextResponse.redirect(google);
  response.cookies.set(COOKIE.state, state, tempCookie());
  response.cookies.set(COOKIE.verifier, verifier, tempCookie());
  response.cookies.set(COOKIE.role, role, tempCookie());
  response.cookies.set(COOKIE.intent, intent, tempCookie());
  return response;
}

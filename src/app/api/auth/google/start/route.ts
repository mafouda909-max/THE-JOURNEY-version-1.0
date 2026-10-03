import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";
import { normalizeAuthIntent, normalizeSelfServeRole } from "@/lib/passwordless-auth";

export const dynamic = "force-dynamic";

const COOKIE = {
  state: "sila_google_state",
  verifier: "sila_google_verifier",
  role: "sila_google_role",
  intent: "sila_google_intent",
} as const;

function baseUrl(request: Request): string {
  if (BRAND.siteUrl !== "http://localhost:3000") return BRAND.siteUrl;
  return new URL(request.url).origin;
}

function tempCookie(value: string) {
  return {
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  };
}

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/join?error=google_not_configured", baseUrl(request)));
  }

  const url = new URL(request.url);
  const role = normalizeSelfServeRole(url.searchParams.get("role")) ?? "traveler";
  const intent = normalizeAuthIntent(url.searchParams.get("intent"));
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const redirectUri = `${baseUrl(request)}/api/auth/google/callback`;

  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.searchParams.set("client_id", clientId);
  google.searchParams.set("redirect_uri", redirectUri);
  google.searchParams.set("response_type", "code");
  google.searchParams.set("scope", "openid email profile");
  google.searchParams.set("state", state);
  google.searchParams.set("code_challenge", challenge);
  google.searchParams.set("code_challenge_method", "S256");
  google.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(google);
  response.cookies.set(COOKIE.state, state, tempCookie(state));
  response.cookies.set(COOKIE.verifier, verifier, tempCookie(verifier));
  response.cookies.set(COOKIE.role, role, tempCookie(role));
  response.cookies.set(COOKIE.intent, intent, tempCookie(intent));
  return response;
}

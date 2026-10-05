import { NextResponse } from "next/server";
import { resolveAuthOriginForRequest } from "@/lib/auth-origin";
import { emailProvider } from "@/lib/provider-gateway";
import { SITE_ORIGIN } from "@/lib/site";
import { passwordAuthConfigured, passwordAuthReadiness } from "@/lib/password-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = resolveAuthOriginForRequest(request.url, SITE_ORIGIN);
  const google =
    Boolean(origin) &&
    process.env.GOOGLE_AUTH_ENABLED === "true" &&
    process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" &&
    Boolean(process.env.GOOGLE_CLIENT_ID?.trim()) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim());

  const magicConfigured =
    Boolean(origin) &&
    process.env.MAGIC_LINK_ENABLED === "true" &&
    process.env.NEXT_PUBLIC_MAGIC_LINK_ENABLED === "true" &&
    Boolean(process.env.RESEND_API_KEY?.trim());

  // An API key alone does not prove that login mail can be sent. The provider
  // coalesces and briefly caches domain probes, without any recipient data.
  const magic = magicConfigured && (await emailProvider.probe()).status === "CONNECTED";

  const legacyPassword =
    Boolean(origin) &&
    process.env.LEGACY_PASSWORD_LOGIN_ENABLED === "true" &&
    process.env.NEXT_PUBLIC_LEGACY_PASSWORD_LOGIN_ENABLED === "true";

  const password = Boolean(origin) && passwordAuthConfigured() && process.env.NEXT_PUBLIC_PASSWORD_AUTH_ENABLED === "true" && await passwordAuthReadiness.probe();
  const recovery =
    password &&
    Boolean(process.env.RESEND_API_KEY?.trim()) &&
    (await emailProvider.probe()).status === "CONNECTED";

  return NextResponse.json(
    { google, magic, password, recovery, legacyPassword },
    { headers: { "Cache-Control": "no-store" } },
  );
}

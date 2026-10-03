import { NextResponse } from "next/server";
import { resolveAuthOrigin } from "@/lib/auth-origin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = resolveAuthOrigin(request.url);
  const google =
    Boolean(origin) &&
    process.env.GOOGLE_AUTH_ENABLED === "true" &&
    process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" &&
    Boolean(process.env.GOOGLE_CLIENT_ID?.trim()) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim());

  const magic =
    Boolean(origin) &&
    process.env.MAGIC_LINK_ENABLED === "true" &&
    process.env.NEXT_PUBLIC_MAGIC_LINK_ENABLED === "true" &&
    Boolean(process.env.RESEND_API_KEY?.trim());

  const legacyPassword =
    process.env.LEGACY_PASSWORD_LOGIN_ENABLED === "true" &&
    process.env.NEXT_PUBLIC_LEGACY_PASSWORD_LOGIN_ENABLED === "true";

  return NextResponse.json(
    { google, magic, legacyPassword },
    { headers: { "Cache-Control": "no-store" } },
  );
}

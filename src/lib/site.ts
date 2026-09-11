const FALLBACK_SITE_URL = "https://the-journey-version-1-0.vercel.app";

// Never default SEO/canonical output to a custom domain unless that domain is
// registered and controlled by the deployment owner. Once an owned custom
// domain is configured and DNS-verified, set NEXT_PUBLIC_SITE_URL explicitly.
const configured =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  FALLBACK_SITE_URL;

export const SITE_URL = configured.replace(/\/+$/, "");
export const SITE_ORIGIN = new URL(SITE_URL).origin;

export function absoluteUrl(path = "/") {
  return new URL(path, `${SITE_ORIGIN}/`).toString();
}

const configured =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://alrehlla.com";

export const SITE_URL = configured.replace(/\/+$/, "");
export const SITE_ORIGIN = new URL(SITE_URL).origin;

export function absoluteUrl(path = "/") {
  return new URL(path, `${SITE_ORIGIN}/`).toString();
}

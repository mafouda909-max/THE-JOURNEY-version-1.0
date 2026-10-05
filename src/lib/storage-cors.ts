import type { CORSRule } from "@aws-sdk/client-s3";

/** CORS permits browser transport; it never grants file authorization. */
export function corsAllowsPrivatePut(rule: CORSRule, origin: string): boolean {
  return Boolean(rule.AllowedOrigins?.some(value => value === origin || value === "*") &&
    rule.AllowedMethods?.includes("PUT") &&
    rule.AllowedHeaders?.some(value => value.toLowerCase() === "content-type" || value === "*"));
}

export function privateUploadCorsRules(existing: CORSRule[], origin: string): { changed: boolean; rules: CORSRule[] } {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.origin !== origin || url.username || url.password) {
    throw new Error("STORAGE_CORS_INVALID_ORIGIN");
  }
  if (existing.some(rule => corsAllowsPrivatePut(rule, origin))) return { changed: false, rules: existing };
  if (existing.length >= 100) throw new Error("STORAGE_CORS_RULE_LIMIT");
  let id = "sila-private-upload";
  for (let suffix = 2; existing.some(rule => rule.ID === id); suffix += 1) id = `sila-private-upload-${suffix}`;
  return {
    changed: true,
    rules: [...existing, {
      ID: id, AllowedOrigins: [origin], AllowedMethods: ["PUT"],
      AllowedHeaders: ["content-type"], ExposeHeaders: ["ETag"], MaxAgeSeconds: 600,
    }],
  };
}

export async function browserPrivateUploadReady(uploadUrl: string, origin: string, signal: AbortSignal, request = fetch): Promise<boolean> {
  const response = await request(uploadUrl, {
    method: "OPTIONS", signal,
    headers: { Origin: origin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" },
  });
  // Consume even rejected responses so the connection is not left pending.
  await response.arrayBuffer();
  const allowedOrigin = response.headers.get("access-control-allow-origin");
  const methods = response.headers.get("access-control-allow-methods")?.split(",").map(value => value.trim()) ?? [];
  const headers = response.headers.get("access-control-allow-headers")?.split(",").map(value => value.trim().toLowerCase()) ?? [];
  return response.ok && (allowedOrigin === origin || allowedOrigin === "*") && methods.includes("PUT") &&
    (headers.includes("content-type") || headers.includes("*"));
}

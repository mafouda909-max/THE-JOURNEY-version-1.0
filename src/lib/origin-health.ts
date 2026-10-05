export type OriginHealthStatus = "HEALTHY" | "NOT_CONFIGURED" | "DEGRADED";

function normalizeOrigin(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function evaluateOriginHealth(siteOrigin: string, configuredAuthOrigin?: string) {
  const authOrigin = normalizeOrigin(configuredAuthOrigin);
  const aligned = authOrigin === null ? null : authOrigin === siteOrigin;

  return {
    site: siteOrigin,
    auth: authOrigin,
    aligned,
    status: (
      authOrigin === null
        ? "NOT_CONFIGURED"
        : aligned
          ? "HEALTHY"
          : "DEGRADED"
    ) as OriginHealthStatus,
  };
}

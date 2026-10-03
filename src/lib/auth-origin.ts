export function resolveAuthOrigin(
  requestUrl: string,
  runtimeEnv = process.env.NODE_ENV,
  configuredOrigin = process.env.AUTH_ORIGIN,
): string | null {
  const configured = configuredOrigin?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
        return null;
      }
      return url.origin;
    } catch {
      return null;
    }
  }

  // Development may use the current request origin. Production/Preview must
  // configure AUTH_ORIGIN explicitly so OAuth and magic links never drift
  // across environments or deployments.
  if (runtimeEnv !== "production") {
    try {
      return new URL(requestUrl).origin;
    } catch {
      return null;
    }
  }
  return null;
}

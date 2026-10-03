export function resolveAuthOrigin(requestUrl: string): string | null {
  const configured = process.env.AUTH_ORIGIN?.trim();
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
  if (process.env.NODE_ENV !== "production") {
    try {
      return new URL(requestUrl).origin;
    } catch {
      return null;
    }
  }
  return null;
}

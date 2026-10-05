export function serviceOriginAllowed(request: Request, configured: string[] = [
  process.env.AUTH_ORIGIN ?? "", process.env.NEXT_PUBLIC_SITE_URL ?? "",
]): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const allowed = new Set([new URL(request.url).origin]);
  // Framework URL normalization behind a proxy must not reject the real app.
  // Only explicit application origins grant access; forwarded hosts do not.
  for (const raw of configured) {
    try {
      const url = new URL(raw);
      if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) allowed.add(url.origin);
    } catch { /* Invalid configuration grants no additional origin. */ }
  }
  return allowed.has(origin);
}

export async function readServiceBody(request: Request): Promise<Record<string, unknown> | null> {
  const reject = (reason: string) => {
    if (process.env.SILA_SERVICE_BROWSER_QA === "true") console.warn("Service request rejected:", reason);
    return null;
  };
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reject("content-type");
  if (!serviceOriginAllowed(request)) return reject("origin");
  try {
    const advertisedLength = request.headers.get("content-length");
    if (advertisedLength && (!/^\d+$/.test(advertisedLength) || Number(advertisedLength) > 32_768)) return reject("advertised-size");
    const reader = request.body?.getReader();
    if (!reader) return reject("missing-body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 32_768) { await reader.cancel(); return reject("stream-size"); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : reject("object-required");
  } catch { return reject("body-decoding"); }
}

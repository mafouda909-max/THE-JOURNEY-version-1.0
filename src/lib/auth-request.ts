// Read the stream, not just Content-Length: chunked requests must share the limit.
export async function readAuthBody(request: Request, maxBytes = 4096): Promise<Record<string, unknown>> {
  if (!/^application\/json$/i.test(request.headers.get("content-type")?.split(";")[0].trim() ?? "")) throw new Error("body");
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) throw new RangeError("body");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("body");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new RangeError("body"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body");
  return parsed as Record<string, unknown>;
}

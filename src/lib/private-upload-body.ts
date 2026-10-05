/** Below Vercel's 4.5 MB request limit, with room for transport overhead. */
export const PRIVATE_GATEWAY_MAX_BYTES = 3 * 1024 * 1024;

export function matchesDocumentContent(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === "application/pdf") return Buffer.from(bytes.subarray(0, 5)).toString() === "%PDF-";
  if (contentType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return false;
}

export async function readPrivateUploadBody(request: Request, signal: AbortSignal): Promise<Buffer> {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) <= 0 || Number(length) > PRIVATE_GATEWAY_MAX_BYTES)) {
    throw new RangeError("PRIVATE_UPLOAD_SIZE");
  }
  if (!request.body) throw new RangeError("PRIVATE_UPLOAD_SIZE");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let rejectAbort: (reason: unknown) => void = () => {};
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const onAbort = () => { rejectAbort(signal.reason); void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    signal.throwIfAborted();
    while (true) {
      const next = await Promise.race([reader.read(), aborted]);
      signal.throwIfAborted();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > PRIVATE_GATEWAY_MAX_BYTES) throw new RangeError("PRIVATE_UPLOAD_SIZE");
      chunks.push(next.value);
    }
    if (!total || (length !== null && total !== Number(length))) throw new RangeError("PRIVATE_UPLOAD_SIZE");
    return Buffer.concat(chunks, total);
  } finally {
    signal.removeEventListener("abort", onAbort);
    void reader.cancel().catch(() => {});
  }
}

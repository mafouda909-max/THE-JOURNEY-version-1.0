/** Minimal classname joiner — dependency-free (AD-16 discipline).
 *  Accepts any falsy junk safely; only non-empty strings survive. */
export function cn(...parts: unknown[]): string {
  let out = "";
  for (const p of parts) {
    if (typeof p === "string" && p.length > 0) {
      if (out) out += " ";
      out += p;
    }
  }
  return out;
}

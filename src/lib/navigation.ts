/**
 * Safe local-path validation for login `next` deep links (AD-04).
 * Accepts ONLY local absolute paths: must start with a single `/`,
 * never `//` or `/\` (protocol-relative), no control characters.
 */
export function safeLocalPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  return raw;
}

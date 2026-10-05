const PRIVATE_PATH = /^\/(?:account|admin|api|auth|join|onboarding|forgot-password|reset-password|verify-email|q|s|review)(?:\/|$)/i;
const SENSITIVE_KEY = /^(?:token|code|state|email|password|authorization|signature|key|secret)$/i;

// Shared by analytics and performance events, including client navigation
// after their scripts have already been loaded on a public page.
export function publicTelemetryEvent<T extends { url: string }>(event: T): T | null {
  try {
    const url = new URL(event.url);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || PRIVATE_PATH.test(decodeURIComponent(url.pathname))) return null;
    for (const key of url.searchParams.keys()) if (SENSITIVE_KEY.test(key)) return null;
    url.search = "";
    url.hash = "";
    return { ...event, url: url.toString() };
  } catch { return null; }
}

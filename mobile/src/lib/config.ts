/**
 * API base-URL resolution for the mobile client.
 *
 * There is deliberately no hard-coded production origin in this package: the
 * deployed host is release configuration, not source code. Resolution order is
 *
 *   1. `expo.extra.apiBaseUrl`   (app.json — set per release profile)
 *   2. `EXPO_PUBLIC_API_BASE_URL` (build-time env var)
 *   3. the Metro packager host    (dev only: a device hits the same Next dev
 *                                   server the browser is using, port 3000)
 *
 * If none resolve, the client reports a `config` error with actionable copy
 * instead of silently pointing at a guessed host.
 */

export const DEFAULT_TIMEOUT_MS = 8_000;
export const DEFAULT_DEV_API_PORT = 3_000;

/** Offers change often enough that 5 minutes is the right freshness window. */
export const OFFERS_CACHE_TTL_MS = 5 * 60_000;
/** Agent profiles are near-static; keep them warm for a quarter of an hour. */
export const AGENTS_CACHE_TTL_MS = 15 * 60_000;
/** Beyond this age a cached payload is dropped rather than shown as "stale". */
export const CACHE_MAX_AGE_MS = 24 * 60 * 60_000;

export type BaseUrlSource = "app-config" | "env" | "packager" | "unset";

export interface ResolvedApiConfig {
  /** Validated absolute origin (scheme://host[:port]) or null when unconfigured. */
  baseUrl: string | null;
  source: BaseUrlSource;
  timeoutMs: number;
  /** Present when `baseUrl` is null — safe to show to a developer, not a traveler. */
  error?: string;
}

const URL_RE = /^(https?):\/\/([^/?#]+)([/?#].*)?$/i;

/**
 * Validate a base URL: absolute http(s) origin, no path, no query, no
 * credentials. Returns the canonical origin (trailing slash trimmed) or null.
 */
export function normalizeBaseUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;

  const match = URL_RE.exec(value);
  if (!match) return null;
  const protocol = match[1]?.toLowerCase();
  const authority = match[2] ?? "";
  const rest = match[3] ?? "";
  if (!authority || (protocol !== "http" && protocol !== "https")) return null;

  // Credentials in a base URL are never legitimate here.
  if (authority.includes("@")) return null;

  // Anything after the authority must be an empty path at most.
  if (rest && rest !== "/") return null;

  const host = extractHost(authority);
  if (!host || !isPlainHost(host)) return null;

  return `${protocol}://${authority}`;
}

/** `host:port` / `[::1]:8081` / `::1` → bare host, lowercase. */
export function extractHost(authority: string): string {
  const value = authority.trim();
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    return end === -1 ? value.slice(1) : value.slice(1, end);
  }
  const firstColon = value.indexOf(":");
  const lastColon = value.lastIndexOf(":");
  // No colon, or more than one (a bare IPv6 address) → there is no port to strip.
  if (firstColon === -1 || firstColon !== lastColon) return value;
  const port = value.slice(lastColon + 1);
  return /^\d+$/.test(port) ? value.slice(0, lastColon) : value;
}

function isPlainHost(host: string): boolean {
  if (!host) return false;
  if (host.includes(":")) return /^[0-9a-fA-F:.]+$/.test(host); // IPv6 literal
  return /^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$/.test(host);
}

/**
 * Metro hands the bundle a `hostUri` like
 * `192.168.1.42:8081/node_modules/expo/AppEntry.bundle?platform=ios`.
 * The Next dev server runs on the same machine, port 3000.
 */
export function apiBaseUrlFromPackagerHost(
  hostUri: unknown,
  port: number = DEFAULT_DEV_API_PORT,
  protocol: "http" | "https" = "http",
): string | null {
  if (typeof hostUri !== "string") return null;
  const authority = hostUri.trim().split("/")[0] ?? "";
  if (!authority) return null;

  const host = extractHost(authority);
  if (!host) return null;
  const hostPart = host.includes(":") ? `[${host}]` : host;
  const safePort = Number.isInteger(port) && port > 0 && port <= 65_535 ? port : DEFAULT_DEV_API_PORT;
  return normalizeBaseUrl(`${protocol}://${hostPart}:${safePort}`);
}

export const MISSING_BASE_URL_ERROR =
  "لم يتم تحديد عنوان الـ API بعد. اضبط expo.extra.apiBaseUrl في app.json أو " +
  "EXPO_PUBLIC_API_BASE_URL، أو شغّل خادم Next محلياً (npm run dev) لاستخدام مضيف التطوير.";

export interface ResolveApiConfigInput {
  /** Value of `Constants.expoConfig.extra.apiBaseUrl`. */
  appConfigBaseUrl?: unknown;
  /** Value of `process.env.EXPO_PUBLIC_API_BASE_URL`. */
  envBaseUrl?: unknown;
  /** Value of `Constants.expoConfig.hostUri` (dev only). */
  packagerHostUri?: string | null;
  isDev?: boolean;
  devApiPort?: number;
  timeoutMs?: number;
}

export function resolveApiConfig(input: ResolveApiConfigInput): ResolvedApiConfig {
  const timeoutMs =
    typeof input.timeoutMs === "number" && input.timeoutMs > 0
      ? Math.round(input.timeoutMs)
      : DEFAULT_TIMEOUT_MS;

  const fromAppConfig = normalizeBaseUrl(input.appConfigBaseUrl);
  if (typeof input.appConfigBaseUrl === "string" && input.appConfigBaseUrl.trim() && !fromAppConfig) {
    return {
      baseUrl: null,
      source: "app-config",
      timeoutMs,
      error: `expo.extra.apiBaseUrl هو بصيغة غير صالحة: "${input.appConfigBaseUrl.trim()}" — المطلوب أصل كامل مثل https://api.example.com بدون مسار.`,
    };
  }
  if (fromAppConfig) return { baseUrl: fromAppConfig, source: "app-config", timeoutMs };

  const fromEnv = normalizeBaseUrl(input.envBaseUrl);
  if (fromEnv) return { baseUrl: fromEnv, source: "env", timeoutMs };

  if (input.isDev) {
    const fromPackager = apiBaseUrlFromPackagerHost(
      input.packagerHostUri,
      input.devApiPort ?? DEFAULT_DEV_API_PORT,
    );
    if (fromPackager) return { baseUrl: fromPackager, source: "packager", timeoutMs };
  }

  return { baseUrl: null, source: "unset", timeoutMs, error: MISSING_BASE_URL_ERROR };
}

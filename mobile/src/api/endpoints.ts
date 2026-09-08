/**
 * Every server route this client talks to, in one place, with the HTTP verb.
 *
 * `tests/mobile-contract.test.ts` (root suite) asserts that each entry maps to a
 * real Next route file under `src/app/api/**` that actually exports that verb.
 * Declaring an endpoint the server does not serve (or dropping a guard the
 * server added) therefore fails CI rather than surfacing on a device.
 */

export interface ApiRouteDeclaration {
  /** Absolute path as the client calls it; `:id` marks a numeric segment. */
  path: string;
  method: "GET" | "POST";
}

export const API_ROUTES: readonly ApiRouteDeclaration[] = [
  { path: "/api/health", method: "GET" },
  { path: "/api/offers", method: "GET" },
  { path: "/api/offers/:id", method: "GET" },
  { path: "/api/agents", method: "GET" },
  { path: "/api/contact-requests", method: "POST" },
];

/** Positive integers only — guards against `/api/offers/NaN` or `/api/offers/-1`. */
export function isEntityId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function idPath(kind: "offers" | "agents", id: unknown): string {
  if (!isEntityId(id)) {
    throw new Error(`api: معرّف ${kind} غير صالح (${String(id)}).`);
  }
  return `/api/${kind}/${id}`;
}

export const API_ENDPOINTS = {
  health: "/api/health",
  offers: "/api/offers",
  agents: "/api/agents",
  contactRequests: "/api/contact-requests",
  offer: (id: unknown): string => idPath("offers", id),
} as const;

/** `/api/offers?status=published&type=umrah` — empty/null filters are dropped. */
export function withQuery(
  path: string,
  params: Record<string, string | number | null | undefined>,
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const rendered = String(value).trim();
    if (!rendered) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(rendered)}`);
  }
  if (parts.length === 0) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${parts.join("&")}`;
}

export function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

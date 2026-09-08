/**
 * Typed client for the THE JOURNEY API, usable from React Native and from plain
 * Node (unit tests inject a fake `fetch`).
 *
 * Contract with the server (see `src/app/api/**`, guarded by the root
 * `mobile-contract` test):
 *   - JSON only; failures are `{ error: string }` with Arabic, user-safe copy.
 *   - `GET /api/offers` → `{ count, offers }`, `status=published` by default.
 *   - `GET /api/offers/:id` → `{ offer: {..., agent } }`, and 404 for any offer
 *     that is not published (the API never leaks drafts by ID).
 *   - `POST /api/contact-requests` → 201 / 404 / 422 / 429 (24h dedupe).
 *   - `GET /api/health` answers 503 *with a JSON body* when degraded, so it is
 *     read as a report rather than treated as a transport failure.
 */

import { API_ENDPOINTS, joinUrl, withQuery } from "./endpoints";
import {
  parseAgent,
  parseAgentsResponse,
  parseHealthResponse,
  parseOffer,
  parseOffersResponse,
  type Agent,
  type ContactRequestAccepted,
  type ContactRequestPayload,
  type HealthResponse,
  type Offer,
} from "./types";

export type ApiErrorKind =
  | "config"
  | "offline"
  | "timeout"
  | "aborted"
  | "not_found"
  | "validation"
  | "forbidden"
  | "rate_limit"
  | "server"
  | "parse"
  | "unknown";

export interface ApiError {
  kind: ApiErrorKind;
  /** Arabic, user-presentable. */
  message: string;
  status?: number;
  retryable: boolean;
  /** Derived from `Retry-After` when the server sends one. */
  retryAfterMs?: number;
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "message" in value &&
    "retryable" in value
  );
}

/** Minimal response surface — `globalThis.fetch` satisfies this in RN and Node. */
export interface HttpResponseLite {
  ok: boolean;
  status: number;
  headers?: { get(name: string): string | null } | undefined;
  text(): Promise<string>;
}

export interface FetchInitLite {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

export type FetchLike = (url: string, init: FetchInitLite) => Promise<HttpResponseLite>;

export interface RetryPolicy {
  /** Total attempts including the first; 1 disables retrying. */
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY: RetryPolicy = { attempts: 3, baseDelayMs: 350, maxDelayMs: 4_000 };

export interface ApiClientOptions {
  baseUrl: string;
  fetchImpl: FetchLike;
  timeoutMs?: number;
  retry?: Partial<RetryPolicy>;
  /** Injectable for deterministic tests. */
  random?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  headers?: Record<string, string>;
}

export interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  query?: Record<string, string | number | null | undefined>;
  signal?: AbortSignal;
  /** Overrides the client-wide timeout for this call. */
  timeoutMs?: number;
}

export interface Settled<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: ApiError | null;
}

const COPY: Record<ApiErrorKind, string> = {
  config: "لم يتم ضبط عنوان الـ API في التطبيق.",
  offline: "تعذّر الوصول إلى الخادم — تحقّق من اتصالك بالإنترنت.",
  timeout: "انتهت مهلة الاتصال بالخادم — جرّب مرة أخرى.",
  aborted: "أُلغي الطلب.",
  not_found: "العنصر غير موجود أو لم يعد منشوراً.",
  validation: "تحقّق من البيانات المدخلة.",
  forbidden: "هذه العملية تحتاج حساب وكيل مسجّل الدخول.",
  rate_limit: "عدد كبير من المحاولات — انتظر قليلاً ثم أعد الإرسال.",
  server: "الخدمة غير متاحة مؤقتاً — نحاول إصلاحها الآن.",
  parse: "استجابة غير متوقعة من الخادم.",
  unknown: "حدث خطأ غير متوقع.",
};

export function kindForStatus(status: number): ApiErrorKind {
  if (status === 404 || status === 410) return "not_found";
  if (status === 422 || status === 400) return "validation";
  if (status === 401 || status === 403) return "forbidden";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server";
  return "unknown";
}

export function retryAfterMs(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1_000));
  const dateMs = Date.parse(value);
  return Number.isNaN(dateMs) ? undefined : Math.max(0, dateMs - Date.now());
}

/** The API's own `{ error }` string wins: it is already Arabic and specific. */
export function serverMessage(body: unknown): string | null {
  if (typeof body === "object" && body !== null && !Array.isArray(body)) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error.trim();
  }
  return null;
}

function safeJsonParse(text: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export interface OfferDetail {
  offer: Offer;
  agent: Agent | null;
}

export interface CallOptions {
  signal?: AbortSignal;
}

export interface ApiClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
  requestSettled<T>(path: string, options?: RequestOptions): Promise<Settled<T>>;
  listOffers(params?: { status?: string; type?: string | null }, call?: CallOptions): Promise<Offer[]>;
  getOfferDetail(id: number, call?: CallOptions): Promise<OfferDetail | null>;
  listAgents(call?: CallOptions): Promise<Agent[]>;
  checkHealth(call?: CallOptions): Promise<Settled<HealthResponse>>;
  sendContactRequest(payload: ContactRequestPayload): Promise<ContactRequestAccepted>;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const timeoutMs = options.timeoutMs ?? 8_000;
  const retry: RetryPolicy = { ...DEFAULT_RETRY, ...(options.retry ?? {}) };
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? defaultSleep;
  const attempts = Math.max(1, Math.min(5, Math.round(retry.attempts)));

  function nextDelay(attemptIndex: number): number {
    const exponential = retry.baseDelayMs * 2 ** attemptIndex;
    const capped = Math.min(retry.maxDelayMs, exponential);
    // Jittered so a recovering API is not stampeded by every device at once.
    return Math.round(capped * (0.5 + random() * 0.5));
  }

  async function once<T>(
    url: string,
    init: FetchInitLite,
    callTimeoutMs: number,
  ): Promise<Settled<T>> {
    const controller = new AbortController();
    const external = init.signal;
    const onExternalAbort = () => controller.abort();
    if (external) {
      if (external.aborted) controller.abort();
      else external.addEventListener("abort", onExternalAbort, { once: true });
    }

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, callTimeoutMs);

    try {
      const response = await options.fetchImpl(url, { ...init, signal: controller.signal });
      const text = await response.text();
      const parsed = safeJsonParse(text);

      if (response.ok) {
        if (parsed === null && text.trim()) {
          return {
            ok: false,
            status: response.status,
            data: null,
            error: { kind: "parse", message: COPY.parse, status: response.status, retryable: false },
          };
        }
        return { ok: true, status: response.status, data: parsed as T, error: null };
      }

      const kind = kindForStatus(response.status);
      return {
        ok: false,
        status: response.status,
        data: parsed as T,
        error: {
          kind,
          message: serverMessage(parsed) ?? COPY[kind],
          status: response.status,
          retryable: response.status >= 500,
          retryAfterMs:
            response.status === 429 ? retryAfterMs(response.headers?.get("retry-after")) : undefined,
        },
      };
    } catch {
      if (controller.signal.aborted) {
        return {
          ok: false,
          status: 0,
          data: null,
          error: {
            kind: timedOut ? "timeout" : "aborted",
            message: timedOut ? COPY.timeout : COPY.aborted,
            retryable: timedOut,
          },
        };
      }
      return {
        ok: false,
        status: 0,
        data: null,
        error: { kind: "offline", message: COPY.offline, retryable: true },
      };
    } finally {
      clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    }
  }

  async function run<T>(path: string, requestOptions: RequestOptions = {}): Promise<Settled<T>> {
    if (!options.baseUrl) {
      return {
        ok: false,
        status: 0,
        data: null,
        error: { kind: "config", message: COPY.config, retryable: false },
      };
    }

    const method = requestOptions.method ?? "GET";
    const url = joinUrl(options.baseUrl, withQuery(path, requestOptions.query ?? {}));
    const callTimeoutMs = requestOptions.timeoutMs ?? timeoutMs;
    const init: FetchInitLite = {
      method,
      headers: {
        accept: "application/json",
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
        ...(options.headers ?? {}),
      },
      ...(requestOptions.body === undefined ? {} : { body: JSON.stringify(requestOptions.body) }),
      ...(requestOptions.signal ? { signal: requestOptions.signal } : {}),
    };

    // Retries are GET-only: a retried POST could double-insert a lead.
    const mayRetry = method === "GET";
    const limit = mayRetry ? attempts : 1;
    let last: Settled<T> | null = null;

    for (let attempt = 0; attempt < limit; attempt += 1) {
      if (requestOptions.signal?.aborted) {
        return {
          ok: false,
          status: 0,
          data: null,
          error: { kind: "aborted", message: COPY.aborted, retryable: false },
        };
      }
      last = await once<T>(url, init, callTimeoutMs);
      if (last.ok || !mayRetry || !last.error?.retryable) return last;
      if (attempt < limit - 1) await sleep(nextDelay(attempt), requestOptions.signal);
    }

    return last ?? {
      ok: false,
      status: 0,
      data: null,
      error: { kind: "unknown", message: COPY.unknown, retryable: false },
    };
  }

  return {
    async request<T>(path: string, requestOptions?: RequestOptions): Promise<T> {
      const settled = await run<T>(path, requestOptions);
      if (!settled.ok) {
        throw settled.error ?? { kind: "unknown", message: COPY.unknown, retryable: false };
      }
      return settled.data as T;
    },

    requestSettled: <T>(path: string, requestOptions?: RequestOptions) =>
      run<T>(path, requestOptions),

    async listOffers(params = {}, call = {}) {
      const data = await run<unknown>(API_ENDPOINTS.offers, {
        query: { status: params.status ?? "published", type: params.type ?? null },
        ...(call.signal ? { signal: call.signal } : {}),
      });
      if (!data.ok) {
        throw data.error ?? { kind: "unknown", message: COPY.unknown, retryable: false };
      }
      return parseOffersResponse(data.data);
    },

    async getOfferDetail(id, call = {}) {
      const settled = await run<unknown>(API_ENDPOINTS.offer(id), {
        ...(call.signal ? { signal: call.signal } : {}),
      });
      if (!settled.ok) {
        if (settled.error?.kind === "not_found") return null;
        throw settled.error ?? { kind: "unknown", message: COPY.unknown, retryable: false };
      }
      const body = settled.data;
      if (typeof body !== "object" || body === null) return null;
      // Server shape: { offer: { ...offer, agent } }
      const record = (body as { offer?: unknown }).offer;
      const offer = parseOffer(record);
      if (!offer) return null;
      const agent =
        typeof record === "object" && record !== null
          ? parseAgent((record as { agent?: unknown }).agent)
          : null;
      return { offer, agent };
    },

    async listAgents(call = {}) {
      const settled = await run<unknown>(API_ENDPOINTS.agents, {
        ...(call.signal ? { signal: call.signal } : {}),
      });
      if (!settled.ok) {
        throw settled.error ?? { kind: "unknown", message: COPY.unknown, retryable: false };
      }
      return parseAgentsResponse(settled.data);
    },

    async checkHealth(call = {}) {
      // 503 here is a *report*, not a transport failure — keep the body either way.
      const settled = await run<unknown>(API_ENDPOINTS.health, {
        timeoutMs: Math.min(timeoutMs, 5_000),
        ...(call.signal ? { signal: call.signal } : {}),
      });
      return {
        ok: settled.status === 200,
        status: settled.status,
        data: parseHealthResponse(settled.data),
        error: settled.error,
      };
    },

    async sendContactRequest(payload) {
      const settled = await run<Record<string, unknown>>(API_ENDPOINTS.contactRequests, {
        method: "POST",
        body: payload,
        // A lead is a mutation: never auto-retried, and an unmount must not
        // abandon it mid-flight, so no AbortSignal is forwarded here.
      });
      if (!settled.ok || !settled.data) {
        throw settled.error ?? { kind: "unknown", message: COPY.unknown, retryable: false };
      }
      const created = settled.data;
      return {
        id: Number(created.id ?? 0),
        createdAt: typeof created.createdAt === "string" ? created.createdAt : new Date().toISOString(),
        status: (typeof created.status === "string" ? created.status : "new") as ContactRequestAccepted["status"],
        message:
          typeof created.message === "string" && created.message.trim()
            ? created.message
            : "وصل طلبك للوكيل — يرد خلال ٤٨ ساعة كحد أقصى.",
      };
    },
  };
}

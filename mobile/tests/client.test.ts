import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createApiClient,
  isApiError,
  kindForStatus,
  retryAfterMs,
  serverMessage,
  type ApiError,
  type HttpResponseLite,
} from "../src/api/client";
import { joinUrl, withQuery } from "../src/api/endpoints";

interface Recorded {
  url: string;
  method?: "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
}

function jsonResponse(status: number, payload: unknown, headers: Record<string, string> = {}): HttpResponseLite {
  const text = JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    text: async () => text,
  };
}

function harness(
  responder: (call: Recorded, attempt: number) => HttpResponseLite | Promise<HttpResponseLite> | Error,
  options: { retry?: { attempts?: number; baseDelayMs?: number; maxDelayMs?: number }; timeoutMs?: number } = {},
) {
  const calls: Recorded[] = [];
  const sleeps: number[] = [];
  const client = createApiClient({
    baseUrl: "https://api.test",
    timeoutMs: options.timeoutMs ?? 500,
    retry: {
      attempts: options.retry?.attempts ?? 1,
      baseDelayMs: options.retry?.baseDelayMs ?? 10,
      maxDelayMs: options.retry?.maxDelayMs ?? 1_000,
    },
    // Deterministic jitter and instant backoff so the suite never sleeps.
    random: () => 0.5,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    fetchImpl: async (url, init) => {
      const record: Recorded = {
        url,
        ...(init.method ? { method: init.method } : {}),
        ...(init.body ? { body: init.body } : {}),
        ...(init.headers ? { headers: init.headers } : {}),
      };
      calls.push(record);
      const result = await responder(record, calls.length);
      if (result instanceof Error) throw result;
      return result;
    },
  });
  return { client, calls, sleeps };
}

const OFFER_FIXTURE = {
  id: 7,
  agentId: 3,
  title: "عمرة اقتصادية ١٤ يوم",
  titleEn: null,
  description: "شامل الطيران والإقامة",
  tripType: "umrah",
  originCity: "القاهرة",
  destinationCity: "مكة المكرمة",
  destinationCountry: "السعودية",
  destinationCountryEn: "Saudi Arabia",
  departureDate: "2027-03-12T00:00:00.000Z",
  durationDays: 14,
  priceAmount: 1950,
  currency: "SAR",
  priceType: "starting_from",
  includes: ["طيران", "فندق"],
  excludes: ["التأشيرة"],
  minTravelers: 1,
  maxTravelers: 8,
  status: "published",
  heroImage: "https://img.test/hero.jpg",
  isFeatured: true,
  viewCount: 12,
  contactCount: 3,
  publishedAt: "2026-09-01T10:00:00.000Z",
  expiresAt: null,
  createdAt: "2026-08-20T10:00:00.000Z",
  agent: {
    id: 3,
    displayName: "أحمد الرحلة",
    latinName: "Ahmed",
    bio: "خبرة ١٢ عاماً",
    photoUrl: "https://img.test/a.jpg",
    city: "جدة",
    country: "السعودية",
    licenseType: "agency",
    licenseNumber: "L-1",
    verificationStatus: "verified",
    verifiedAt: null,
    specialtyTags: ["عمرة"],
    languages: ["ar", "en"],
    responseRate: 92,
    avgResponseHours: 4,
    totalTrips: 300,
    joinedAt: "2024-01-01T00:00:00.000Z",
  },
};

describe("listOffers", () => {
  it("requests published offers and unwraps the { count, offers } envelope", async () => {
    const { client, calls } = harness(() => jsonResponse(200, { count: 1, offers: [OFFER_FIXTURE] }));
    const offers = await client.listOffers();
    assert.equal(calls[0]?.url, "https://api.test/api/offers?status=published");
    assert.equal(offers.length, 1);
    assert.equal(offers[0]?.title, OFFER_FIXTURE.title);
    assert.equal(offers[0]?.agent?.displayName, "أحمد الرحلة");
  });

  it("passes the trip-type filter and drops it when set to all", async () => {
    const filtered = harness(() => jsonResponse(200, { count: 0, offers: [] }));
    await filtered.client.listOffers({ type: "umrah" });
    assert.equal(filtered.calls[0]?.url, "https://api.test/api/offers?status=published&type=umrah");

    const unfiltered = harness(() => jsonResponse(200, { count: 0, offers: [] }));
    await unfiltered.client.listOffers({ type: null });
    assert.equal(unfiltered.calls[0]?.url, "https://api.test/api/offers?status=published");
  });

  it("tolerates malformed rows by dropping them rather than crashing the list", async () => {
    const { client } = harness(() =>
      jsonResponse(200, { count: 2, offers: [OFFER_FIXTURE, { nope: true }, null] }),
    );
    const offers = await client.listOffers();
    assert.equal(offers.length, 1);
  });
});

describe("error mapping", () => {
  it("maps status codes to kinds", () => {
    assert.equal(kindForStatus(404), "not_found");
    assert.equal(kindForStatus(422), "validation");
    assert.equal(kindForStatus(401), "forbidden");
    assert.equal(kindForStatus(429), "rate_limit");
    assert.equal(kindForStatus(503), "server");
    assert.equal(kindForStatus(418), "unknown");
  });

  it("surfaces the server's Arabic copy and does not retry a 422", async () => {
    const { client, calls } = harness(() =>
      jsonResponse(422, { error: "صيغة البريد الإلكتروني غير صحيحة." }),
      { retry: { attempts: 3 } },
    );
    await assert.rejects(client.listOffers(), (error: unknown) => {
      assert.ok(isApiError(error));
      const apiError = error as ApiError;
      assert.equal(apiError.kind, "validation");
      assert.equal(apiError.message, "صيغة البريد الإلكتروني غير صحيحة.");
      assert.equal(apiError.status, 422);
      assert.equal(apiError.retryable, false);
      return true;
    });
    assert.equal(calls.length, 1);
  });

  it("retries retryable 5xx GETs with backoff, then gives up", async () => {
    const { client, calls, sleeps } = harness(() => jsonResponse(503, { error: "صيانة" }), {
      retry: { attempts: 3 },
    });
    await assert.rejects(client.listOffers(), (error: unknown) => {
      assert.equal((error as ApiError).kind, "server");
      assert.equal((error as ApiError).retryable, true);
      return true;
    });
    assert.equal(calls.length, 3);
    assert.equal(sleeps.length, 2);
    // Exponential and jittered: base*2^n * (0.5 + 0.5*random) with base=10, random()=0.5
    assert.deepEqual(sleeps, [Math.round(10 * 0.75), Math.round(20 * 0.75)]);
  });

  it("never retries a POST — a retried lead would be inserted twice", async () => {
    const { client, calls } = harness(() => jsonResponse(500, { error: "عطل" }), {
      retry: { attempts: 3 },
    });
    await assert.rejects(
      client.sendContactRequest({
        offerId: 7,
        travelerName: "سالم",
        travelerEmail: "sa@lem.com",
        travelerCount: 2,
        message: "هل يتوفر موعد في رمضان؟",
      }),
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.method, "POST");
  });

  it("reads Retry-After on 429 and keeps it non-retryable", async () => {
    const { client, calls } = harness(() =>
      jsonResponse(429, { error: "انتظر قليلاً" }, { "retry-after": "30" }),
      { retry: { attempts: 3 } },
    );
    await assert.rejects(client.listOffers(), (error: unknown) => {
      const apiError = error as ApiError;
      assert.equal(apiError.kind, "rate_limit");
      assert.equal(apiError.retryAfterMs, 30_000);
      assert.equal(apiError.retryable, false);
      return true;
    });
    assert.equal(calls.length, 1);
    assert.equal(retryAfterMs(null), undefined);
    assert.equal(retryAfterMs("2"), 2_000);
  });

  it("treats a transport failure as offline and retryable", async () => {
    const { client, calls } = harness(() => new Error("Network request failed"), {
      retry: { attempts: 2 },
    });
    await assert.rejects(client.listAgents(), (error: unknown) => {
      assert.equal((error as ApiError).kind, "offline");
      return true;
    });
    assert.equal(calls.length, 2);
  });

  it("reports a config error when the base URL is empty", async () => {
    const client = createApiClient({ baseUrl: "", fetchImpl: async () => jsonResponse(200, {}) });
    await assert.rejects(client.listOffers(), (error: unknown) => {
      assert.equal((error as ApiError).kind, "config");
      return true;
    });
  });

  it("rejects non-JSON success bodies instead of handing back null", async () => {
    const { client } = harness(() => ({
      ok: true,
      status: 200,
      text: async () => "<!doctype html><html>proxy error</html>",
    }));
    await assert.rejects(client.listOffers(), (error: unknown) => {
      assert.equal((error as ApiError).kind, "parse");
      return true;
    });
  });

  it("keeps serverMessage tolerant of non-error bodies", () => {
    assert.equal(serverMessage({ error: "  موجود  " }), "موجود");
    assert.equal(serverMessage({ error: "" }), null);
    assert.equal(serverMessage([1, 2]), null);
    assert.equal(serverMessage("text"), null);
  });

  it("parses HTTP-date Retry-After without going negative", () => {
    const past = retryAfterMs(new Date(Date.now() - 60_000).toUTCString());
    assert.equal(past, 0);
    assert.equal(retryAfterMs("not-a-date"), undefined);
  });
});

describe("getOfferDetail", () => {
  it("unwraps the { offer: {..., agent} } shape", async () => {
    const { client, calls } = harness(() => jsonResponse(200, { offer: OFFER_FIXTURE }));
    const detail = await client.getOfferDetail(7);
    assert.equal(calls[0]?.url, "https://api.test/api/offers/7");
    assert.equal(detail?.offer.id, 7);
    assert.equal(detail?.agent?.id, 3);
  });

  it("maps a 404 (unpublished or missing) to null", async () => {
    const { client } = harness(() => jsonResponse(404, { error: "العرض غير متاح" }));
    assert.equal(await client.getOfferDetail(99), null);
  });

  it("refuses to build a URL for an invalid id", async () => {
    const { client, calls } = harness(() => jsonResponse(200, {}));
    await assert.rejects(() => client.getOfferDetail(Number.NaN), /معرّف offers غير صالح/);
    await assert.rejects(() => client.getOfferDetail(0), /معرّف offers غير صالح/);
    assert.equal(calls.length, 0);
  });
});

describe("health reporting", () => {
  it("returns the body on 503 — a degraded report is not a transport error", async () => {
    const { client } = harness(() =>
      jsonResponse(503, { status: "UNAVAILABLE", ok: false, error: "db down", timestamp: "2026-09-08T00:00:00.000Z" }),
    );
    const report = await client.checkHealth();
    assert.equal(report.ok, false);
    assert.equal(report.status, 503);
    assert.equal(report.data?.status, "UNAVAILABLE");
    assert.equal(report.data?.error, "db down");
  });

  it("reads a healthy report including latency", async () => {
    const { client } = harness(() =>
      jsonResponse(200, {
        status: "HEALTHY",
        ok: true,
        database: { status: "HEALTHY", latencyMs: 41 },
        storage: { status: "HEALTHY" },
        timestamp: "2026-09-08T00:00:00.000Z",
      }),
    );
    const report = await client.checkHealth();
    assert.equal(report.ok, true);
    assert.equal(report.data?.database?.latencyMs, 41);
    assert.equal(report.data?.storage?.status, "HEALTHY");
  });

  it("classifies an unusable body as UNAVAILABLE", async () => {
    const { client } = harness(() => new Error("boom"));
    const report = await client.checkHealth();
    assert.equal(report.ok, false);
    assert.equal(report.data?.status, "UNAVAILABLE");
    assert.equal(report.error?.kind, "offline");
  });
});

describe("sendContactRequest", () => {
  it("posts the payload and returns the accepted lead", async () => {
    const { client, calls } = harness(() =>
      jsonResponse(201, {
        id: 55,
        createdAt: "2026-09-08T09:00:00.000Z",
        status: "new",
        message: "وصل طلبك للوكيل — يرد خلال ٤٨ ساعة كحد أقصى.",
      }),
    );
    const accepted = await client.sendContactRequest({
      offerId: 7,
      travelerName: "سالم",
      travelerEmail: "SA@LEM.com",
      travelerCount: 2,
      message: "هل يتوفر موعد في رمضان؟",
    });
    assert.equal(accepted.id, 55);
    assert.match(accepted.message, /وصل طلبك/);
    const sent = JSON.parse(calls[0]?.body ?? "{}") as Record<string, unknown>;
    assert.equal(sent.offerId, 7);
    assert.equal(calls[0]?.headers?.["content-type"], "application/json");
  });

  it("falls back to the server default copy when the body omits a message", async () => {
    const { client } = harness(() => jsonResponse(201, { id: 56 }));
    const accepted = await client.sendContactRequest({
      offerId: 7,
      travelerName: "سالم",
      travelerEmail: "sa@lem.com",
      travelerCount: 2,
      message: "سؤال طويل بما يكفي",
    });
    assert.equal(accepted.id, 56);
    assert.equal(accepted.status, "new");
    assert.match(accepted.message, /٤٨ ساعة/);
  });
});

describe("timeout handling", () => {
  it("abandons a hung request and reports a timeout", async () => {
    const client = createApiClient({
      baseUrl: "https://api.test",
      timeoutMs: 10,
      retry: { attempts: 1 },
      fetchImpl: (_url, init) =>
        new Promise<HttpResponseLite>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    });
    await assert.rejects(client.listOffers(), (error: unknown) => {
      assert.equal((error as ApiError).kind, "timeout");
      assert.match((error as ApiError).message, /انتهت مهلة/);
      return true;
    });
  });
});

describe("url helpers", () => {
  it("joins without doubling slashes", () => {
    assert.equal(joinUrl("https://api.test/", "/api/health"), "https://api.test/api/health");
    assert.equal(joinUrl("https://api.test", "api/health"), "https://api.test/api/health");
  });

  it("builds queries and percent-encodes values", () => {
    assert.equal(withQuery("/api/offers", {}), "/api/offers");
    assert.equal(
      withQuery("/api/offers", { status: "published", type: null, empty: "  ", n: 3 }),
      "/api/offers?status=published&n=3",
    );
    assert.equal(withQuery("/api/offers?a=1", { b: "x y" }), "/api/offers?a=1&b=x%20y");
  });
});

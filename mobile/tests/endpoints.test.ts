import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { API_ENDPOINTS, API_ROUTES, isEntityId } from "../src/api/endpoints";

describe("API_ROUTES", () => {
  it("declares only paths and verbs the client actually calls", () => {
    assert.deepEqual(
      API_ROUTES.map((route) => `${route.method} ${route.path}`),
      [
        "GET /api/health",
        "GET /api/offers",
        "GET /api/offers/:id",
        "GET /api/agents",
        "POST /api/contact-requests",
      ],
    );
  });

  it("keeps the literal paths in sync with API_ENDPOINTS", () => {
    const declared = new Set(API_ROUTES.map((route) => route.path));
    assert.ok(declared.has(API_ENDPOINTS.health));
    assert.ok(declared.has(API_ENDPOINTS.offers));
    assert.ok(declared.has(API_ENDPOINTS.agents));
    assert.ok(declared.has(API_ENDPOINTS.contactRequests));
  });
});

describe("id guards", () => {
  it("accepts safe positive integers only", () => {
    assert.equal(isEntityId(1), true);
    assert.equal(isEntityId(42), true);
    assert.equal(isEntityId(0), false);
    assert.equal(isEntityId(-3), false);
    assert.equal(isEntityId(1.5), false);
    assert.equal(isEntityId(Number.NaN), false);
    assert.equal(isEntityId("7"), false);
    assert.equal(isEntityId(Number.MAX_SAFE_INTEGER + 1), false);
  });

  it("builds an id path or throws before hitting the network", () => {
    assert.equal(API_ENDPOINTS.offer(7), "/api/offers/7");
    assert.throws(() => API_ENDPOINTS.offer("7" as unknown as number), /معرّف offers غير صالح/);
  });
});

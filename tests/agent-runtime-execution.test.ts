import assert from "node:assert/strict";
import test from "node:test";
import type {
  AgentAuditEvent,
  AgentRequest,
  AgentToolCall,
} from "../src/lib/agent-runtime/contracts";
import { AgentRuntime } from "../src/lib/agent-runtime/runtime";
import { AgentToolRegistry } from "../src/lib/agent-runtime/tool-registry";
import {
  registerTravelReadTools,
  TRAVEL_FLIGHT_SEARCH_TOOL,
  TRAVEL_WEB_SEARCH_TOOL,
} from "../src/lib/agent-runtime/travel-tools";

const now = "2026-10-05T00:00:00.000Z";

function request(toolName: string): AgentRequest {
  return {
    requestId: "req-travel-1",
    agent: "travel_intelligence",
    task: "source-aware travel research",
    autonomyLevel: "L0_READ_ONLY",
    actor: { role: "traveler", authenticated: false },
    requestedTools: [toolName],
    input: {},
    createdAt: now,
  };
}

function call(toolName: string, args: Record<string, unknown>): AgentToolCall {
  return {
    callId: "call-1",
    requestId: "req-travel-1",
    toolName,
    args,
    requestedAt: now,
  };
}

test("runtime executes registered read-only web tool with evidence and audit", async () => {
  const registry = new AgentToolRegistry();
  registerTravelReadTools(registry, {
    async searchWeb(query, options) {
      assert.equal(query, "Turkey visa rules");
      assert.equal(options.maxResults, 3);
      return {
        query,
        retrievedAt: now,
        freshness: "fresh",
        results: [
          {
            title: "Official rules",
            url: "https://official.example/rules",
            content: "Evidence",
          },
        ],
      };
    },
    async searchFlights() {
      throw new Error("unexpected flight search");
    },
  });

  const audit: AgentAuditEvent[] = [];
  const runtime = new AgentRuntime({
    registry,
    now: () => now,
    auditSink: (event) => {
      audit.push(event);
    },
  });

  const result = await runtime.execute(
    request(TRAVEL_WEB_SEARCH_TOOL),
    call(TRAVEL_WEB_SEARCH_TOOL, {
      query: "Turkey visa rules",
      maxResults: 3,
    }),
  );

  assert.equal(result.status, "ok");
  assert.equal(result.evidence?.[0]?.source, "https://official.example/rules");
  assert.equal(result.evidence?.[0]?.freshnessStatus, "fresh");
  assert.equal(audit.length, 1);
  assert.equal(audit[0]?.outcome, "completed");
});

test("runtime executes canonical flight search through injected supplier adapter", async () => {
  const registry = new AgentToolRegistry();
  registerTravelReadTools(registry, {
    async searchWeb() {
      throw new Error("unexpected web search");
    },
    async searchFlights(input) {
      assert.equal(input.originIata, "CAI");
      assert.equal(input.destinationIata, "IST");
      assert.equal(input.adults, 2);
      return {
        provider: "Amadeus Self-Service",
        configured: true,
        connected: true,
        checkedAt: now,
        warnings: [],
        offers: [
          {
            id: "offer-1",
            source: {
              provider: "Amadeus",
              kind: "GDS",
              authorityLevel: 4,
              checkedAt: now,
            },
            originIata: "CAI",
            destinationIata: "IST",
            departureDate: "2026-11-01",
            price: { total: 15000, currency: "EGP" },
            travelerCount: 2,
            durationMinutes: 180,
            stops: 0,
            validatingAirlines: ["TK"],
            fare: { refundable: null, changeable: null },
            segments: [],
            freshnessMinutes: 0,
            warnings: [],
          },
        ],
      };
    },
  });

  const runtime = new AgentRuntime({ registry, now: () => now });
  const result = await runtime.execute(
    request(TRAVEL_FLIGHT_SEARCH_TOOL),
    call(TRAVEL_FLIGHT_SEARCH_TOOL, {
      originIata: "cai",
      destinationIata: "ist",
      departureDate: "2026-11-01",
      adults: 2,
      currency: "egp",
    }),
  );

  assert.equal(result.status, "ok");
  assert.equal(result.evidence?.[0]?.source, "supplier:Amadeus Self-Service");
  assert.deepEqual(result.evidence?.[0]?.supports, ["offer-1"]);
});

test("runtime fails closed before executing undeclared tools", async () => {
  const registry = new AgentToolRegistry();
  let called = false;
  registerTravelReadTools(registry, {
    async searchWeb() {
      called = true;
      throw new Error("should not execute");
    },
    async searchFlights() {
      called = true;
      throw new Error("should not execute");
    },
  });

  const runtime = new AgentRuntime({ registry, now: () => now });
  const req = request(TRAVEL_WEB_SEARCH_TOOL);
  req.requestedTools = [];

  const result = await runtime.execute(
    req,
    call(TRAVEL_WEB_SEARCH_TOOL, { query: "rules" }),
  );

  assert.equal(result.status, "denied");
  assert.equal(called, false);
});

test("travel tools validate supplier inputs before provider execution", async () => {
  const registry = new AgentToolRegistry();
  let supplierCalled = false;
  registerTravelReadTools(registry, {
    async searchWeb() {
      throw new Error("unexpected web search");
    },
    async searchFlights() {
      supplierCalled = true;
      throw new Error("should not execute");
    },
  });

  const runtime = new AgentRuntime({ registry, now: () => now });
  const result = await runtime.execute(
    request(TRAVEL_FLIGHT_SEARCH_TOOL),
    call(TRAVEL_FLIGHT_SEARCH_TOOL, {
      originIata: "CAIRO",
      destinationIata: "IST",
      departureDate: "2026-11-01",
    }),
  );

  assert.equal(result.status, "error");
  assert.equal(result.error, "INVALID_ORIGIN_IATA");
  assert.equal(supplierCalled, false);
});

test("mismatched request ownership is denied before handler execution", async () => {
  const registry = new AgentToolRegistry();
  let called = false;
  registerTravelReadTools(registry, {
    async searchWeb() {
      called = true;
      throw new Error("should not execute");
    },
    async searchFlights() {
      called = true;
      throw new Error("should not execute");
    },
  });

  const runtime = new AgentRuntime({ registry, now: () => now });
  const toolCall = call(TRAVEL_WEB_SEARCH_TOOL, { query: "rules" });
  toolCall.requestId = "another-request";

  const result = await runtime.execute(
    request(TRAVEL_WEB_SEARCH_TOOL),
    toolCall,
  );

  assert.equal(result.status, "denied");
  assert.equal(called, false);
});

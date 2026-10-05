import assert from "node:assert/strict";
import test from "node:test";
import type { AgentAuditEvent } from "../src/lib/agent-runtime/contracts";
import { AgentRuntime } from "../src/lib/agent-runtime/runtime";
import { AgentToolRegistry } from "../src/lib/agent-runtime/tool-registry";
import {
  registerTravelReadTools,
  TRAVEL_WEB_SEARCH_TOOL,
} from "../src/lib/agent-runtime/travel-tools";

const now = "2026-10-05T00:00:00.000Z";

test("runtime audit payload excludes tool input and provider output", async () => {
  const registry = new AgentToolRegistry();
  registerTravelReadTools(registry, {
    async searchWeb(query) {
      return {
        query,
        retrievedAt: now,
        freshness: "fresh",
        results: [
          {
            title: "Sensitive-looking external text",
            url: "https://example.com/rules",
            content: "do-not-copy-this-provider-payload",
          },
        ],
      };
    },
    async searchFlights() {
      throw new Error("unexpected");
    },
  });

  const events: AgentAuditEvent[] = [];
  const runtime = new AgentRuntime({
    registry,
    now: () => now,
    auditSink: (event) => events.push(event),
  });

  const result = await runtime.execute(
    {
      requestId: "req-safe-audit",
      agent: "travel_intelligence",
      task: "research",
      autonomyLevel: "L0_READ_ONLY",
      actor: { role: "traveler", authenticated: true, accountId: 42 },
      requestedTools: [TRAVEL_WEB_SEARCH_TOOL],
      input: { privateNote: "must-not-enter-audit" },
      createdAt: now,
    },
    {
      callId: "call-safe-audit",
      requestId: "req-safe-audit",
      toolName: TRAVEL_WEB_SEARCH_TOOL,
      args: { query: "secret-looking-query" },
      requestedAt: now,
    },
  );

  assert.equal(result.status, "ok");
  assert.equal(events.length, 1);

  const serialized = JSON.stringify(events[0]);
  assert.equal(serialized.includes("secret-looking-query"), false);
  assert.equal(serialized.includes("do-not-copy-this-provider-payload"), false);
  assert.equal(serialized.includes("must-not-enter-audit"), false);
  assert.equal(events[0]?.metadata?.evidenceCount, 1);
});

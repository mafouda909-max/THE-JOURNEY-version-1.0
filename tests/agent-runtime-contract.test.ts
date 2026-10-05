import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAgentToolPolicy } from "../src/lib/agent-runtime/policy";
import { AgentToolRegistry } from "../src/lib/agent-runtime/tool-registry";
import type {
  AgentRequest,
  AgentToolDefinition,
} from "../src/lib/agent-runtime/contracts";

function request(
  overrides: Partial<AgentRequest> = {},
): AgentRequest {
  return {
    requestId: "req-1",
    agent: "travel_intelligence",
    task: "compare evidence",
    autonomyLevel: "L0_READ_ONLY",
    actor: { role: "traveler", authenticated: true, accountId: 10 },
    requestedTools: ["travel.search"],
    input: {},
    createdAt: "2026-10-05T00:00:00.000Z",
    ...overrides,
  };
}

const readTool: AgentToolDefinition = {
  name: "travel.search",
  description: "Read source-aware travel data.",
  effects: ["read"],
  risk: "low",
  requiresAuth: false,
  requiresApproval: false,
  allowedActors: ["traveler", "agent", "admin", "system"],
};

test("read-only requests may use explicitly requested read tools", () => {
  assert.deepEqual(
    evaluateAgentToolPolicy(request(), readTool),
    {
      outcome: "allow",
      reasons: ["Tool call satisfies deterministic runtime policy."],
    },
  );
});

test("undeclared tools fail closed", () => {
  const decision = evaluateAgentToolPolicy(
    request({ requestedTools: [] }),
    readTool,
  );

  assert.equal(decision.outcome, "deny");
});

test("L0 blocks suggestion and mutation capabilities", () => {
  const suggestionTool: AgentToolDefinition = {
    ...readTool,
    name: "offer.suggest",
    effects: ["suggest"],
  };
  const writeTool: AgentToolDefinition = {
    ...readTool,
    name: "offer.publish",
    effects: ["write"],
  };

  assert.equal(
    evaluateAgentToolPolicy(
      request({ requestedTools: [suggestionTool.name] }),
      suggestionTool,
    ).outcome,
    "deny",
  );

  assert.equal(
    evaluateAgentToolPolicy(
      request({ requestedTools: [writeTool.name] }),
      writeTool,
    ).outcome,
    "deny",
  );
});

test("L1 can suggest but cannot write", () => {
  const suggestionTool: AgentToolDefinition = {
    ...readTool,
    name: "offer.suggest",
    effects: ["suggest"],
  };
  const writeTool: AgentToolDefinition = {
    ...readTool,
    name: "offer.update",
    effects: ["write"],
  };

  assert.equal(
    evaluateAgentToolPolicy(
      request({
        autonomyLevel: "L1_SUGGESTION",
        requestedTools: [suggestionTool.name],
      }),
      suggestionTool,
    ).outcome,
    "allow",
  );

  assert.equal(
    evaluateAgentToolPolicy(
      request({
        autonomyLevel: "L1_SUGGESTION",
        requestedTools: [writeTool.name],
      }),
      writeTool,
    ).outcome,
    "deny",
  );
});

test("high-risk and external actions require human approval", () => {
  const externalTool: AgentToolDefinition = {
    ...readTool,
    name: "message.send",
    effects: ["external"],
    risk: "high",
    requiresAuth: true,
    allowedActors: ["agent", "admin", "system"],
  };

  const decision = evaluateAgentToolPolicy(
    request({
      autonomyLevel: "L2_POLICY_BOUND_ACTION",
      actor: { role: "agent", authenticated: true, accountId: 50 },
      requestedTools: [externalTool.name],
    }),
    externalTool,
  );

  assert.equal(decision.outcome, "approval_required");
  assert.ok(decision.reasons.length >= 1);
});

test("authenticated-only tools deny unauthenticated actors", () => {
  const privateTool: AgentToolDefinition = {
    ...readTool,
    name: "traveler.workspace.read",
    requiresAuth: true,
  };

  const decision = evaluateAgentToolPolicy(
    request({
      actor: { role: "traveler", authenticated: false },
      requestedTools: [privateTool.name],
    }),
    privateTool,
  );

  assert.equal(decision.outcome, "deny");
});

test("tool registry rejects ambiguous registrations", () => {
  const registry = new AgentToolRegistry();
  registry.register(readTool);

  assert.throws(() => registry.register(readTool), /already registered/);
  assert.equal(registry.get("travel.search")?.risk, "low");
});

import type {
  AgentPolicyDecision,
  AgentRequest,
  AgentToolDefinition,
  ToolEffect,
} from "./contracts";

const writeLikeEffects = new Set<ToolEffect>(["write", "external"]);

export function evaluateAgentToolPolicy(
  request: AgentRequest,
  tool: AgentToolDefinition,
): AgentPolicyDecision {
  const reasons: string[] = [];

  if (!request.requestedTools.includes(tool.name)) {
    return {
      outcome: "deny",
      reasons: ["Tool was not declared in the request capability set."],
    };
  }

  if (!tool.allowedActors.includes(request.actor.role)) {
    return {
      outcome: "deny",
      reasons: ["Actor role is not allowed to use this tool."],
    };
  }

  if (tool.requiresAuth && !request.actor.authenticated) {
    return {
      outcome: "deny",
      reasons: ["Authenticated actor required."],
    };
  }

  const hasWriteLikeEffect = tool.effects.some((effect) => writeLikeEffects.has(effect));
  const hasSuggestEffect = tool.effects.includes("suggest");

  if (request.autonomyLevel === "L0_READ_ONLY") {
    if (hasWriteLikeEffect || hasSuggestEffect) {
      return {
        outcome: "deny",
        reasons: ["L0_READ_ONLY requests may invoke read-only tools only."],
      };
    }
  }

  if (request.autonomyLevel === "L1_SUGGESTION" && hasWriteLikeEffect) {
    return {
      outcome: "deny",
      reasons: ["L1_SUGGESTION requests cannot perform writes or external side effects."],
    };
  }

  if (tool.requiresApproval) {
    reasons.push("Tool explicitly requires human approval.");
  }

  if (tool.risk === "high") {
    reasons.push("High-risk tools always require human approval.");
  }

  if (tool.effects.includes("external")) {
    reasons.push("External side effects require human approval.");
  }

  if (reasons.length > 0) {
    return { outcome: "approval_required", reasons };
  }

  return {
    outcome: "allow",
    reasons: ["Tool call satisfies deterministic runtime policy."],
  };
}

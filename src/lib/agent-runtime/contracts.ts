export type AgentAutonomyLevel =
  | "L0_READ_ONLY"
  | "L1_SUGGESTION"
  | "L2_POLICY_BOUND_ACTION";

export type AgentActorRole = "traveler" | "agent" | "admin" | "system";

export type ToolEffect = "read" | "suggest" | "write" | "external";

export type RiskTier = "low" | "medium" | "high";

export interface AgentActor {
  role: AgentActorRole;
  authenticated: boolean;
  accountId?: number;
  tenantId?: string;
}

export interface AgentEvidence {
  source: string;
  sourceType: "official" | "supplier" | "internal" | "web" | "user";
  observedAt: string;
  freshnessStatus: "fresh" | "stale" | "unknown";
  supports?: string[];
}

export interface AgentRequest {
  requestId: string;
  agent:
    | "travel_intelligence"
    | "flight_gds"
    | "visa_readiness"
    | "agent_copilot"
    | "growth"
    | "trust"
    | "community"
    | "operations";
  task: string;
  autonomyLevel: AgentAutonomyLevel;
  actor: AgentActor;
  requestedTools: string[];
  input: Record<string, unknown>;
  createdAt: string;
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  effects: ToolEffect[];
  risk: RiskTier;
  requiresAuth: boolean;
  requiresApproval: boolean;
  allowedActors: AgentActorRole[];
}

export interface AgentToolCall {
  callId: string;
  requestId: string;
  toolName: string;
  args: Record<string, unknown>;
  requestedAt: string;
}

export interface AgentToolResult {
  callId: string;
  toolName: string;
  status: "ok" | "error" | "denied" | "approval_required";
  output?: unknown;
  error?: string;
  evidence?: AgentEvidence[];
  completedAt: string;
}

export interface AgentPolicyDecision {
  outcome: "allow" | "deny" | "approval_required";
  reasons: string[];
}

export interface AgentAuditEvent {
  eventId: string;
  requestId: string;
  callId?: string;
  actor: AgentActor;
  action: string;
  outcome: "allowed" | "denied" | "approval_required" | "completed" | "failed";
  toolName?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type CapabilityId = "database" | "storage" | "ai" | "ai_documents" | "web" | "email" | "email_risk" | "flights" | "gds" | "ndc" | "hotels" | "visa" | "currency" | "geo" | "documents" | "notifications" | "payments" | "social" | "whatsapp" | "mcp";
export type CapabilityActor = "system" | "admin" | "traveler" | "agent" | "anonymous";
export type CapabilityStatus = "READY" | "NOT_CONFIGURED" | "CONFIGURATION_REQUIRED" | "GATED" | "PLANNED" | "DEGRADED";
export type FailureCode = "TIMEOUT" | "PROVIDER_UNAVAILABLE" | "CIRCUIT_OPEN" | "NOT_CONFIGURED" | "CONFIGURATION_REQUIRED" | "GATED" | "PLANNED" | "FORBIDDEN" | "UNKNOWN_OPERATION";

export interface CapabilityDefinition {
  id: CapabilityId;
  label: string;
  description: string;
  implemented: boolean;
  sensitivity: "public" | "account" | "private" | "financial";
  trust: "first_party" | "untrusted_external" | "supplier_evidence" | "delivery_channel";
  actors: readonly CapabilityActor[];
  readOnly: boolean;
  cost: { model: "none" | "credits" | "per_call" | "contract"; unitPrice: null };
  fallback: "none" | "deterministic" | "explicit_unavailable";
  freshness: "runtime_observation" | "source_dependent" | "not_available";
  license: "first_party" | "provider_terms" | "not_selected";
  vendorSla: null;
  policy: { probeTimeoutMs: number; callTimeoutMs: number; retries: number; failureThreshold: number; cooldownMs: number; cacheMs: number };
  prerequisites: readonly string[];
}

export interface CapabilityAdapter {
  provider: string;
  configured(): boolean;
  enabled?(): boolean;
  probe(signal: AbortSignal): Promise<{ status: "READY" | "NOT_CONFIGURED" | "CONFIGURATION_REQUIRED" | "DEGRADED" }>;
}

export interface CapabilityState extends CapabilityDefinition {
  provider: string | null;
  status: CapabilityStatus;
  ready: boolean;
  checkedAt: string | null;
  latencyMs: number | null;
  lastSuccessAt: string | null;
  failureCode: FailureCode | null;
  consecutiveFailures: number;
  circuit: "closed" | "open" | "half_open";
  observationScope: "current_runtime";
}

export interface CapabilityObservation {
  capability: CapabilityId;
  operation: "probe" | "call";
  outcome: "success" | "failure" | "fallback";
  code: FailureCode | null;
  durationMs: number;
}

export class CapabilityError extends Error {
  constructor(readonly code: FailureCode) { super(code); this.name = "CapabilityError"; }
}

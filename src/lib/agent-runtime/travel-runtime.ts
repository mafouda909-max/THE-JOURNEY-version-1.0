import type { AgentRuntimeOptions } from "./runtime";
import { AgentRuntime } from "./runtime";
import { persistAgentAuditEvent } from "./db-audit";
import { AgentToolRegistry } from "./tool-registry";
import {
  registerTravelReadTools,
  type TravelReadToolDependencies,
} from "./travel-tools";

export interface CreateTravelAgentRuntimeOptions
  extends Pick<AgentRuntimeOptions, "now"> {
  dependencies?: TravelReadToolDependencies;
  auditSink?: AgentRuntimeOptions["auditSink"];
}

/**
 * Build an isolated runtime instance for read-only travel intelligence.
 *
 * A fresh registry is created per runtime so registration is deterministic and
 * callers cannot accidentally inherit tools registered elsewhere.
 */
export function createTravelAgentRuntime(
  options: CreateTravelAgentRuntimeOptions = {},
): AgentRuntime {
  const registry = new AgentToolRegistry();
  registerTravelReadTools(registry, options.dependencies);

  return new AgentRuntime({
    registry,
    now: options.now,
    auditSink: options.auditSink ?? persistAgentAuditEvent,
  });
}

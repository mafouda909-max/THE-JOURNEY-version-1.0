import type {
  AgentAuditEvent,
  AgentPolicyDecision,
  AgentRequest,
  AgentToolCall,
  AgentToolResult,
} from "./contracts";
import { evaluateAgentToolPolicy } from "./policy";
import {
  AgentToolRegistry,
  agentToolRegistry,
} from "./tool-registry";

export type AgentAuditSink = (
  event: AgentAuditEvent,
) => void | Promise<void>;

export interface AgentRuntimeOptions {
  registry?: AgentToolRegistry;
  auditSink?: AgentAuditSink;
  now?: () => string;
}

export class AgentRuntime {
  private readonly registry: AgentToolRegistry;
  private readonly auditSink?: AgentAuditSink;
  private readonly now: () => string;

  constructor(options: AgentRuntimeOptions = {}) {
    this.registry = options.registry ?? agentToolRegistry;
    this.auditSink = options.auditSink;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  public async execute(
    request: AgentRequest,
    call: AgentToolCall,
  ): Promise<AgentToolResult> {
    if (call.requestId !== request.requestId) {
      return this.finishDenied(
        request,
        call,
        "Tool call requestId does not match the owning AgentRequest.",
      );
    }

    const tool = this.registry.get(call.toolName);
    if (!tool) {
      return this.finishDenied(
        request,
        call,
        "Unknown or unregistered agent tool.",
      );
    }

    const decision = evaluateAgentToolPolicy(request, tool);
    if (decision.outcome !== "allow") {
      return this.finishPolicyDecision(request, call, decision);
    }

    const handler = this.registry.getHandler(call.toolName);
    if (!handler) {
      const completedAt = this.now();
      await this.emitAudit(request, call, "failed", {
        reason: "TOOL_HANDLER_NOT_REGISTERED",
      });
      return {
        callId: call.callId,
        toolName: call.toolName,
        status: "error",
        error: "TOOL_HANDLER_NOT_REGISTERED",
        completedAt,
      };
    }

    try {
      const handled = await handler(call.args);
      const completedAt = this.now();
      await this.emitAudit(request, call, "completed", {
        evidenceCount: handled.evidence?.length ?? 0,
      });
      return {
        callId: call.callId,
        toolName: call.toolName,
        status: "ok",
        output: handled.output,
        evidence: handled.evidence,
        completedAt,
      };
    } catch (error) {
      const completedAt = this.now();
      const message =
        error instanceof Error ? error.message : "AGENT_TOOL_EXECUTION_FAILED";
      await this.emitAudit(request, call, "failed", { error: message });
      return {
        callId: call.callId,
        toolName: call.toolName,
        status: "error",
        error: message,
        completedAt,
      };
    }
  }

  private async finishDenied(
    request: AgentRequest,
    call: AgentToolCall,
    reason: string,
  ): Promise<AgentToolResult> {
    const completedAt = this.now();
    await this.emitAudit(request, call, "denied", { reasons: [reason] });
    return {
      callId: call.callId,
      toolName: call.toolName,
      status: "denied",
      error: reason,
      completedAt,
    };
  }

  private async finishPolicyDecision(
    request: AgentRequest,
    call: AgentToolCall,
    decision: AgentPolicyDecision,
  ): Promise<AgentToolResult> {
    const completedAt = this.now();
    const outcome =
      decision.outcome === "approval_required"
        ? "approval_required"
        : "denied";

    await this.emitAudit(request, call, outcome, {
      reasons: decision.reasons,
    });

    return {
      callId: call.callId,
      toolName: call.toolName,
      status:
        decision.outcome === "approval_required"
          ? "approval_required"
          : "denied",
      error: decision.reasons.join(" "),
      completedAt,
    };
  }

  private async emitAudit(
    request: AgentRequest,
    call: AgentToolCall,
    outcome: AgentAuditEvent["outcome"],
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.auditSink) return;

    const createdAt = this.now();
    await this.auditSink({
      eventId: `${request.requestId}:${call.callId}:${outcome}`,
      requestId: request.requestId,
      callId: call.callId,
      actor: request.actor,
      action: `tool:${call.toolName}`,
      outcome,
      toolName: call.toolName,
      metadata,
      createdAt,
    });
  }
}

export const agentRuntime = new AgentRuntime();

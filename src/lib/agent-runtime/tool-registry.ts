import type {
  AgentEvidence,
  AgentToolDefinition,
} from "./contracts";

export interface AgentToolHandlerResult {
  output: unknown;
  evidence?: AgentEvidence[];
}

export type AgentToolHandler = (
  args: Record<string, unknown>,
) => Promise<AgentToolHandlerResult>;

export class AgentToolRegistry {
  private readonly tools = new Map<string, AgentToolDefinition>();
  private readonly handlers = new Map<string, AgentToolHandler>();

  public register(tool: AgentToolDefinition, handler?: AgentToolHandler): void {
    if (!tool.name.trim()) {
      throw new Error("Agent tool name is required.");
    }

    if (this.tools.has(tool.name)) {
      throw new Error(`Agent tool already registered: ${tool.name}`);
    }

    if (tool.effects.length === 0) {
      throw new Error(`Agent tool must declare at least one effect: ${tool.name}`);
    }

    if (tool.allowedActors.length === 0) {
      throw new Error(`Agent tool must declare at least one allowed actor: ${tool.name}`);
    }

    this.tools.set(tool.name, Object.freeze({ ...tool }));
    if (handler) this.handlers.set(tool.name, handler);
  }

  public get(name: string): AgentToolDefinition | null {
    return this.tools.get(name) ?? null;
  }

  public getHandler(name: string): AgentToolHandler | null {
    return this.handlers.get(name) ?? null;
  }

  public list(): AgentToolDefinition[] {
    return Array.from(this.tools.values());
  }
}

export const agentToolRegistry = new AgentToolRegistry();

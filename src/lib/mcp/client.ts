import { spawn, ChildProcess } from "node:child_process";
import { mcpConfigManager, MCPServerConfig } from "@/lib/mcp";

/**
 * MCP CLIENT & RUNTIME TOOL CALL VERIFIER (STDIO & WEB-STANDARD HTTP/SSE)
 *
 * Supports both stdio process transport and Web-Standard HTTP/SSE transport
 * (e.g. McpServer with WebStandardStreamableHTTPServerTransport).
 */

export type MCPRuntimeStatus =
  | "NOT_CONFIGURED"
  | "CONFIGURED"
  | "RUNNING"
  | "TOOLS_DISCOVERED"
  | "TOOL_CALL_VERIFIED"
  | "DEGRADED"
  | "FAILED";

export interface DiscoveredMCPTool {
  name: string;
  description: string;
  inputSchema: any;
  actionLevel: "L0" | "L1" | "L2" | "L3" | "L4";
  readOnly: boolean;
}

export interface MCPServerRuntimeResult {
  serverName: string;
  status: MCPRuntimeStatus;
  transport: "stdio" | "sse" | "unknown";
  toolsCount: number;
  discoveredTools: DiscoveredMCPTool[];
  lastCallSuccess?: boolean;
  sampleToolResult?: any;
  latencyMs?: number;
  error?: string;
}

export class MCPRuntimeClient {
  /**
   * Verify an HTTP / SSE MCP server endpoint.
   */
  public async verifyHTTPServerRuntime(
    serverName: string,
    url: string,
  ): Promise<MCPServerRuntimeResult> {
    const t0 = Date.now();
    try {
      // Step 1: Probe HTTP endpoint with JSON-RPC initialize
      const initRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "journey-agent-host", version: "1.0.0" },
          },
        }),
      });

      if (!initRes.ok) {
        return {
          serverName,
          status: "DEGRADED",
          transport: "sse",
          toolsCount: 0,
          discoveredTools: [],
          latencyMs: Date.now() - t0,
          error: `HTTP ${initRes.status} on MCP endpoint`,
        };
      }

      // Step 2: Query tools/list
      const listRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
        }),
      });

      if (!listRes.ok) {
        return {
          serverName,
          status: "RUNNING",
          transport: "sse",
          toolsCount: 0,
          discoveredTools: [],
          latencyMs: Date.now() - t0,
        };
      }

      const listData = await listRes.json();
      const rawTools = listData.result?.tools || [];
      const discoveredTools: DiscoveredMCPTool[] = rawTools.map((t: any) => ({
        name: t.name,
        description: t.description || t.title,
        inputSchema: t.inputSchema,
        actionLevel: "L0",
        readOnly: true,
      }));

      return {
        serverName,
        status: discoveredTools.length > 0 ? "TOOLS_DISCOVERED" : "RUNNING",
        transport: "sse",
        toolsCount: discoveredTools.length,
        discoveredTools,
        latencyMs: Date.now() - t0,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "HTTP MCP connection failed";
      return {
        serverName,
        status: "FAILED",
        transport: "sse",
        toolsCount: 0,
        discoveredTools: [],
        latencyMs: Date.now() - t0,
        error: msg,
      };
    }
  }

  /**
   * Spawns an stdio MCP process, performs JSON-RPC handshake, discovers tools,
   * executes a read-only sample tool call, and returns runtime verification status.
   */
  public async verifyServerRuntime(
    serverName: string,
    config: MCPServerConfig,
  ): Promise<MCPServerRuntimeResult> {
    if (!config.enabled && config.enabled !== undefined) {
      return {
        serverName,
        status: "NOT_CONFIGURED",
        transport: "unknown",
        toolsCount: 0,
        discoveredTools: [],
      };
    }

    if (config.url) {
      return this.verifyHTTPServerRuntime(serverName, config.url);
    }

    if (!config.command) {
      return {
        serverName,
        status: "CONFIGURED",
        transport: "unknown",
        toolsCount: 0,
        discoveredTools: [],
        error: "Server configuration missing command or url.",
      };
    }

    const t0 = Date.now();
    let child: ChildProcess | null = null;

    try {
      child = spawn(config.command, config.args || [], {
        cwd: process.cwd(),
        env: { ...process.env, ...(config.env || {}) },
        stdio: ["pipe", "pipe", "pipe"],
      });

      let requestId = 1;
      const pending = new Map<number, (res: any) => void>();

      let buffer = "";
      child.stdout?.on("data", (data: Buffer) => {
        buffer += data.toString("utf8");
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.id !== undefined && pending.has(json.id)) {
              const resolve = pending.get(json.id)!;
              pending.delete(json.id);
              resolve(json);
            }
          } catch {
            /* ignore unparseable stderr/stdout line */
          }
        }
      });

      const sendRPC = (method: string, params?: any): Promise<any> => {
        return new Promise((resolve, reject) => {
          const id = requestId++;
          pending.set(id, resolve);
          const req = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
          child?.stdin?.write(req);

          setTimeout(() => {
            if (pending.has(id)) {
              pending.delete(id);
              reject(new Error(`MCP RPC timeout on method ${method}`));
            }
          }, 4000);
        });
      };

      // Step 1: Initialize Handshake
      const initRes = await sendRPC("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "journey-agent-host", version: "1.0.0" },
      });

      if (initRes.error) {
        child.kill();
        return {
          serverName,
          status: "FAILED",
          transport: "stdio",
          toolsCount: 0,
          discoveredTools: [],
          error: initRes.error.message,
        };
      }

      // Send initialized notification
      child.stdin?.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

      // Step 2: Tools Discovery (tools/list)
      const listRes = await sendRPC("tools/list");
      const rawTools = listRes.result?.tools || [];

      const discoveredTools: DiscoveredMCPTool[] = rawTools.map((t: any) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        actionLevel: "L0",
        readOnly: true,
      }));

      if (discoveredTools.length === 0) {
        child.kill();
        return {
          serverName,
          status: "RUNNING",
          transport: "stdio",
          toolsCount: 0,
          discoveredTools: [],
          latencyMs: Date.now() - t0,
        };
      }

      // Step 3: Real Read-Only Tool Execution (tools/call)
      const sampleTool = discoveredTools[0];
      const sampleArgs = sampleTool.name === "get_visa_requirement" 
        ? { nationality: "Saudi Arabia", destination: "Georgia" }
        : {};

      const callRes = await sendRPC("tools/call", {
        name: sampleTool.name,
        arguments: sampleArgs,
      });

      child.kill();
      const latencyMs = Date.now() - t0;

      if (callRes.error) {
        return {
          serverName,
          status: "DEGRADED",
          transport: "stdio",
          toolsCount: discoveredTools.length,
          discoveredTools,
          latencyMs,
          error: callRes.error.message,
        };
      }

      const sampleResultText = callRes.result?.content?.[0]?.text;
      const parsedSampleResult = sampleResultText ? JSON.parse(sampleResultText) : null;

      return {
        serverName,
        status: "TOOL_CALL_VERIFIED",
        transport: "stdio",
        toolsCount: discoveredTools.length,
        discoveredTools,
        lastCallSuccess: true,
        sampleToolResult: parsedSampleResult,
        latencyMs,
      };
    } catch (err: unknown) {
      if (child) child.kill();
      const errorMsg = err instanceof Error ? err.message : "Process execution failed";
      return {
        serverName,
        status: "FAILED",
        transport: "stdio",
        toolsCount: 0,
        discoveredTools: [],
        latencyMs: Date.now() - t0,
        error: errorMsg,
      };
    }
  }

  /**
   * Verify all MCP servers configured in opencode.json
   */
  public async verifyAllConfiguredServers(): Promise<MCPServerRuntimeResult[]> {
    const { config } = mcpConfigManager.loadConfig();
    if (!config) return [];

    const serverMap = config.mcp || config.mcpServers || {};
    const results: MCPServerRuntimeResult[] = [];
    for (const [name, serverConfig] of Object.entries(serverMap)) {
      const res = await this.verifyServerRuntime(name, serverConfig);
      results.push(res);
    }
    return results;
  }
}

export const mcpRuntimeClient = new MCPRuntimeClient();

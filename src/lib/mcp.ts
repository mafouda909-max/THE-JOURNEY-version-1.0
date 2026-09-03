import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ToolStatus } from "@/lib/tools";

/**
 * MCP SERVER CONFIGURATION PARSER & STATUS PROBER
 *
 * Supports both OpenCode schema (https://opencode.ai/config.json) under 'mcp'
 * and standard MCP schema under 'mcpServers'.
 */

export interface MCPServerConfig {
  enabled?: boolean;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

export interface GenericMCPConfig {
  $schema?: string;
  mcp?: Record<string, MCPServerConfig>;
  mcpServers?: Record<string, MCPServerConfig>;
}

export interface MCPServerState {
  name: string;
  enabled: boolean;
  type: "stdio" | "sse" | "unknown";
  status: ToolStatus;
  urlOrCommand?: string;
}

export class MCPConfigManager {
  /**
   * Load and parse MCP configuration from opencode.json, .opencode/config.json, or mcp.json
   */
  public loadConfig(): { config: GenericMCPConfig | null; configPath: string | null } {
    const candidatePaths = [
      // Scoped to the config/ subfolder on purpose: probing project-root files
      // (opencode.json / mcp.json at cwd) made Turbopack trace the entire
      // project into the serverless bundle (NFT over-tracing). The canonical
      // location used by this workspace is config/mcp.json.
      join(process.cwd(), "config", "mcp.json"),
      join(process.cwd(), "config", "opencode.json"),
    ];

    for (const p of candidatePaths) {
      if (existsSync(p)) {
        try {
          const parsed = JSON.parse(readFileSync(p, "utf8"));
          return { config: parsed, configPath: p };
        } catch {
          /* ignore JSON parse errors */
        }
      }
    }

    return { config: null, configPath: null };
  }

  /**
   * Get operational state of configured MCP servers.
   */
  public getMCPServerStates(): {
    configured: boolean;
    configPath: string | null;
    servers: MCPServerState[];
  } {
    const { config, configPath } = this.loadConfig();
    if (!config) {
      return { configured: false, configPath: null, servers: [] };
    }

    const serverMap = config.mcp || config.mcpServers;
    if (!serverMap) {
      return { configured: false, configPath, servers: [] };
    }

    const servers: MCPServerState[] = [];
    for (const [name, server] of Object.entries(serverMap)) {
      const enabled = server.enabled !== false;
      let type: "stdio" | "sse" | "unknown" = "unknown";
      let urlOrCommand: string | undefined = undefined;

      if (server.command) {
        type = "stdio";
        urlOrCommand = `${server.command} ${(server.args || []).join(" ")}`.trim();
      } else if (server.url) {
        type = "sse";
        urlOrCommand = server.url;
      }

      servers.push({
        name,
        enabled,
        type,
        status: enabled ? "CONFIGURED" : "DISABLED",
        urlOrCommand,
      });
    }

    return {
      configured: true,
      configPath,
      servers,
    };
  }
}

export const mcpConfigManager = new MCPConfigManager();

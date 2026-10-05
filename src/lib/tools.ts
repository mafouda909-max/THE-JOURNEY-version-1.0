import { adminAuthConfigured } from "@/lib/auth";
import { CAPABILITY_CATALOG } from "@/lib/capabilities/catalog";
import { capabilityRuntime } from "@/lib/capabilities/production";
import type { CapabilityId, CapabilityState } from "@/lib/capabilities/contracts";

export type ToolStatus = "NOT_CONFIGURED" | "CONFIGURED" | "RUNNING" | "TOOLS_DISCOVERED" | "TOOL_CALL_VERIFIED" | "CONNECTED" | "DEGRADED" | "CONFIGURATION_REQUIRED" | "DISABLED" | "FAILED" | "PLANNED" | "GATED";
export type ActionLevel = "L0" | "L1" | "L2" | "L3" | "L4";
export interface ToolSpec { key: string; name: string; domain: string; level: ActionLevel; readOnly: boolean; roles: string[]; credentialEnv: string[]; note: string }
export interface ToolState extends ToolSpec, Omit<CapabilityState, "status"> { status: ToolStatus; missing: string[]; error?: string }

const KEYS: Partial<Record<CapabilityId, string>> = { storage: "media_b2", ai: "ai_runtime", web: "web_research", flights: "travel_supplier", visa: "visa_data", mcp: "mcp_travel_intel", social: "social_meta" };
const ENV: Partial<Record<CapabilityId, string[]>> = {
  database: ["DATABASE_URL"], storage: ["B2_ENDPOINT", "B2_BUCKET_NAME", "B2_KEY_ID", "B2_APPLICATION_KEY"],
  ai: ["OPENROUTER_API_KEY"], web: ["TAVILY_API_KEY", "VERCEL_OIDC_TOKEN"], email: ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "RESEND_SENDING_DOMAIN_ID"], flights: ["AMADEUS_CLIENT_ID", "AMADEUS_CLIENT_SECRET"],
  ai_documents: ["OPENAI_API_KEY"],
};
function spec(c: typeof CAPABILITY_CATALOG[number]): ToolSpec {
  const credentialEnv = c.id === "ai" && process.env.OPENAI_API_KEY?.trim() ? ["OPENAI_API_KEY"] : ENV[c.id] ?? [];
  return { key: KEYS[c.id] ?? c.id, name: c.label, domain: c.id, level: c.id === "payments" ? "L4" : c.id === "email" || c.id === "social" || c.id === "whatsapp" ? "L3" : c.readOnly ? "L1" : "L2", readOnly: c.readOnly, roles: [...c.actors], credentialEnv, note: c.description };
}
// Compatibility projection of the owned capability catalog; no second registry.
export const TOOL_REGISTRY = CAPABILITY_CATALOG.map(spec);
export async function getToolMatrix(force = false): Promise<ToolState[]> {
  return (await capabilityRuntime.all(force)).map((state) => {
    const metadata = spec(state);
    return { ...state, ...metadata, status: state.status === "READY" ? "CONNECTED" : state.status, missing: metadata.credentialEnv.filter((key) => !process.env[key]?.trim()), ...(state.failureCode ? { error: state.failureCode } : {}) };
  });
}
export async function getPlatformStatus() {
  return { adminAuth: adminAuthConfigured ? "CONFIGURED" : "NOT_CONFIGURED", mcp: "PLANNED", mcpServers: [], checkedAt: new Date().toISOString() };
}

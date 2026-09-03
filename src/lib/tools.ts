import { sql } from "drizzle-orm";
import { db } from "@/db";
import { r2Configured, R2_BUCKET } from "@/lib/r2";
import { adminAuthConfigured } from "@/lib/auth";
import { travelWebProvider } from "@/lib/providers/web";
import { aiProvider } from "@/lib/providers/ai";
import { emailProvider } from "@/lib/providers/email";
import { mcpConfigManager } from "@/lib/mcp";
import { mcpRuntimeClient } from "@/lib/mcp/client";

/**
 * THE JOURNEY TOOL LAYER — Registry & Live Connection Status.
 *
 * Doctrine: An integration is 'CONNECTED' or 'TOOL_CALL_VERIFIED' only after a real
 * runtime health check / tool call succeeds. An existing environment variable
 * or config file alone yields 'CONFIGURED', never 'CONNECTED'.
 */

export type ToolStatus =
  | "NOT_CONFIGURED"
  | "CONFIGURED"
  | "RUNNING"
  | "TOOLS_DISCOVERED"
  | "TOOL_CALL_VERIFIED"
  | "CONNECTED"
  | "DEGRADED"
  | "CONFIGURATION_REQUIRED"
  | "DISABLED"
  | "FAILED";

export type ActionLevel = "L0" | "L1" | "L2" | "L3" | "L4";

export interface ToolSpec {
  key: string;
  name: string;
  domain: string;
  level: ActionLevel;
  readOnly: boolean;
  roles: string[];
  credentialEnv: string[];
  note: string;
}

export interface ToolState extends ToolSpec {
  status: ToolStatus;
  missing: string[];
  latencyMs: number | null;
  error?: string;
  checkedAt: string;
}

export const TOOL_REGISTRY: ToolSpec[] = [
  {
    key: "database", name: "PostgreSQL (app)", domain: "data",
    level: "L1", readOnly: true, roles: ["admin", "system"],
    credentialEnv: ["DATABASE_URL"],
    note: "وصل استعلامات PostgreSQL الموثق — قاعدة البيانات الأحادية المعتمدة.",
  },
  {
    key: "media_r2", name: "Cloudflare R2", domain: "storage",
    level: "L2", readOnly: false, roles: ["admin"],
    credentialEnv: ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"],
    note: "Presigned URLs فقط — توقيع قصير الأمد للملفات.",
  },
  {
    key: "ai_runtime", name: "OpenRouter AI Runtime", domain: "ai",
    level: "L1", readOnly: true, roles: ["system"],
    credentialEnv: ["OPENROUTER_API_KEY"],
    note: "موزّع النماذج: GPT-4o-mini للاستخراج السريع وSonnet 3.5 للتحليل والمراجعة.",
  },
  {
    key: "web_research", name: "Tavily Web Research", domain: "travel_intel",
    level: "L0", readOnly: true, roles: ["system"],
    credentialEnv: ["TAVILY_API_KEY"],
    note: "قراءة معزولة للبحث واستخراج الحقائق السياحية الموثّقة.",
  },
  {
    key: "mcp_travel_intel", name: "Travel Intelligence MCP", domain: "mcp",
    level: "L0", readOnly: true, roles: ["system", "admin"],
    credentialEnv: [],
    note: "خادم MCP بروتوكول JSON-RPC لاستكشاف الأدوات واستدعائها مباشرة.",
  },
  {
    key: "visa_data", name: "Visa / Entry Sources", domain: "travel_intel",
    level: "L0", readOnly: true, roles: ["system"],
    credentialEnv: ["VISA_PROVIDER_KEY"],
    note: "مصادر التأشيرات الرسمية — النتيجة provenance كاملة.",
  },
  {
    key: "travel_supplier", name: "GDS / NDC Adapter", domain: "commerce",
    level: "L2", readOnly: true, roles: ["system"],
    credentialEnv: ["AMADEUS_CLIENT_ID", "AMADEUS_CLIENT_SECRET"],
    note: "محول الرحلات والأسعار — جاهز للربط الفعلي.",
  },
  {
    key: "email", name: "Resend Transactional Email", domain: "notifications",
    level: "L3", readOnly: false, roles: ["system"],
    credentialEnv: ["RESEND_API_KEY"],
    note: "إرسال التنبيهات الموثقة — يتطلب نطاق إرسال مفعل.",
  },
  {
    key: "social_meta", name: "Meta (FB/IG)", domain: "social",
    level: "L3", readOnly: false, roles: ["admin", "system"],
    credentialEnv: ["META_ACCESS_TOKEN", "META_PAGE_ID"],
    note: "بوابة اعتماد المحتوى والتسويق.",
  },
  {
    key: "whatsapp", name: "WhatsApp Business", domain: "social",
    level: "L3", readOnly: false, roles: ["admin", "system"],
    credentialEnv: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID"],
    note: "قوالب التنبيهات المعتمدة وطلبات التواصل.",
  },
  {
    key: "payments", name: "Payments Engine", domain: "commerce",
    level: "L4", readOnly: true, roles: ["admin"],
    credentialEnv: ["STRIPE_SECRET_KEY"],
    note: "حركة الأموال والاشتراكات — تحت التحكم البشري.",
  },
];

function env(name: string): string | null {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v : null;
}

async function probe(key: string): Promise<{
  status: ToolStatus;
  latencyMs: number | null;
  error?: string;
}> {
  const t0 = Date.now();
  try {
    if (key === "database") {
      await db.execute(sql`select 1`);
      return { status: "CONNECTED", latencyMs: Date.now() - t0 };
    }
    if (key === "media_r2") {
      return { status: r2Configured ? "CONFIGURED" : "NOT_CONFIGURED", latencyMs: null };
    }
    if (key === "web_research") {
      const p = await travelWebProvider.probe();
      return { status: p.status, latencyMs: p.latencyMs, error: p.error };
    }
    if (key === "ai_runtime") {
      const p = await aiProvider.probe();
      return { status: p.status, latencyMs: p.latencyMs, error: p.error };
    }
    if (key === "email") {
      const p = await emailProvider.probe();
      return { status: p.status, latencyMs: p.latencyMs, error: p.error };
    }
    if (key === "mcp_travel_intel") {
      const mcpResults = await mcpRuntimeClient.verifyAllConfiguredServers();
      const verified = mcpResults.find((r) => r.status === "TOOL_CALL_VERIFIED" || r.status === "TOOLS_DISCOVERED");
      if (verified) {
        return { status: verified.status, latencyMs: verified.latencyMs || null };
      }
      return { status: "CONFIGURED", latencyMs: null };
    }

    const spec = TOOL_REGISTRY.find((t) => t.key === key);
    if (!spec) return { status: "NOT_CONFIGURED", latencyMs: null };
    const hasAll = spec.credentialEnv.every((e) => env(e));
    return { status: hasAll ? "CONFIGURED" : "NOT_CONFIGURED", latencyMs: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Probe failed";
    return { status: "DEGRADED", latencyMs: Date.now() - t0, error: errorMsg };
  }
}

export async function getToolMatrix(): Promise<ToolState[]> {
  return Promise.all(
    TOOL_REGISTRY.map(async (t) => {
      const health = await probe(t.key);
      return {
        ...t,
        status: health.status,
        latencyMs: health.latencyMs,
        error: health.error,
        missing: t.credentialEnv.filter((e) => !env(e)),
        checkedAt: new Date().toISOString(),
      };
    }),
  );
}

export async function getPlatformStatus() {
  const mcpRuntimeResults = await mcpRuntimeClient.verifyAllConfiguredServers();
  const activeMcp = mcpRuntimeResults.find((r) => r.status === "TOOL_CALL_VERIFIED");

  return {
    adminAuth: adminAuthConfigured ? "CONFIGURED" : "NOT_CONFIGURED",
    mcp: activeMcp ? ("TOOL_CALL_VERIFIED" as ToolStatus) : ("CONFIGURED" as ToolStatus),
    mcpServers: mcpRuntimeResults,
    r2Bucket: R2_BUCKET,
    checkedAt: new Date().toISOString(),
  };
}

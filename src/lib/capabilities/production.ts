import { sql } from "drizzle-orm";
import { db } from "@/db";
import { b2Configured, probeB2 } from "@/lib/b2";
import { aiProvider } from "@/lib/providers/ai";
import { travelWebProvider } from "@/lib/providers/web";
import { emailProvider } from "@/lib/providers/email";
import { probeDocumentAI } from "@/lib/providers/document-ai";
import { trackEvent } from "@/lib/data";
import { CAPABILITY_CATALOG } from "./catalog";
import { CapabilityRuntime } from "./runtime";
import type { CapabilityAdapter } from "./contracts";

const mapped = (status: string): Awaited<ReturnType<CapabilityAdapter["probe"]>> => ({ status: status === "CONNECTED" ? "READY" : status === "NOT_CONFIGURED" ? "NOT_CONFIGURED" : status === "CONFIGURATION_REQUIRED" ? "CONFIGURATION_REQUIRED" : "DEGRADED" });
export const capabilityRuntime = new CapabilityRuntime(CAPABILITY_CATALOG, (event) => {
  // Closed metadata fields only. No prompts, addresses, arguments, URLs,
  // document keys, provider responses or exception text enter this event.
  void trackEvent("capability_observed", { meta: `cap=${event.capability};op=${event.operation};status=${event.outcome};code=${event.code ?? "OK"};ms=${Math.max(0, Math.round(event.durationMs))}` });
});

capabilityRuntime.register("database", { provider: "postgresql", configured: () => Boolean(process.env.DATABASE_URL), async probe() { await db.execute(sql`SELECT 1`); return { status: "READY" }; } });
capabilityRuntime.register("storage", { provider: "backblaze_b2", configured: () => b2Configured, async probe(signal) { return mapped((await probeB2(signal)).status); } });
capabilityRuntime.register("ai", { provider: "ai_router", configured: () => aiProvider.isConfigured(), async probe(signal) { return mapped((await aiProvider.probe(signal)).status); } });
capabilityRuntime.register("ai_documents", { provider: "openai_documents", configured: () => Boolean(process.env.OPENAI_API_KEY?.trim()), enabled: () => process.env.AI_DOCUMENT_REVIEW_ENABLED === "true", async probe(signal) { return { status: await probeDocumentAI(signal) ? "READY" : "DEGRADED" }; } });
capabilityRuntime.register("web", { provider: "tavily", configured: () => travelWebProvider.isConfigured(), async probe(signal) { return mapped((await travelWebProvider.probe(signal)).status); } });
capabilityRuntime.register("email", { provider: "resend", configured: () => emailProvider.isConfigured() || Boolean(process.env.RESEND_API_KEY?.trim()), async probe(signal) { return mapped((await emailProvider.probe(signal)).status); } });
capabilityRuntime.register("flights", {
  provider: "amadeus_self_service", configured: () => Boolean(process.env.AMADEUS_CLIENT_ID?.trim() && process.env.AMADEUS_CLIENT_SECRET?.trim()),
  enabled: () => process.env.FLIGHT_COMPARE_ENABLED === "true",
  async probe(signal) { const { amadeusSupplier } = await import("@/lib/travel-suppliers/amadeus"); return { status: (await amadeusSupplier.probe(signal)).connected ? "READY" : "DEGRADED" }; },
});
capabilityRuntime.register("documents", { provider: "sila_private_documents", configured: () => Boolean(process.env.DATABASE_URL) && b2Configured, async probe(signal) { await db.execute(sql`SELECT id FROM agent_documents WHERE false`); return mapped((await probeB2(signal)).status); } });
capabilityRuntime.register("notifications", { provider: "sila_in_app", configured: () => Boolean(process.env.DATABASE_URL), async probe() { await db.execute(sql`SELECT id FROM notifications WHERE false`); return { status: "READY" }; } });

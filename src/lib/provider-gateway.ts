import { aiProvider as aiAdapter, type OfferReviewRequest, type OfferDraftAssistRequest } from "@/lib/providers/ai";
import { travelWebProvider as webAdapter } from "@/lib/providers/web";
import { emailProvider as emailAdapter, type EmailParams, type EmailProbeResult, type EmailResult } from "@/lib/providers/email";
import type { FlightSearchInput, SupplierSearchResult } from "@/lib/travel-suppliers/types";
import { capabilityRuntime } from "@/lib/capabilities/production";
import { CapabilityError } from "@/lib/capabilities/contracts";

export const emailProvider = {
  isConfigured: () => emailAdapter.isConfigured(),
  async probe(): Promise<EmailProbeResult> {
    const state = await capabilityRuntime.probe("email", true);
    return { status: state.status === "READY" ? "CONNECTED" : state.status === "NOT_CONFIGURED" ? "NOT_CONFIGURED" : state.status === "CONFIGURATION_REQUIRED" ? "CONFIGURATION_REQUIRED" : "DEGRADED", latencyMs: state.latencyMs, ...(state.failureCode ? { error: state.failureCode } : {}) };
  },
  async sendEmail(params: EmailParams): Promise<EmailResult> {
    try {
      return await capabilityRuntime.call("email", "system", async (signal) => {
        const result = await emailAdapter.sendEmail(params, signal);
        if (!result.sent) throw new CapabilityError(result.status === "CONFIGURATION_REQUIRED" ? "CONFIGURATION_REQUIRED" : "PROVIDER_UNAVAILABLE");
        return { sent: true, status: "QUEUED", id: result.id };
      });
    } catch (error) {
      const code = error instanceof CapabilityError ? error.code : "PROVIDER_UNAVAILABLE";
      return { sent: false, status: ["CONFIGURATION_REQUIRED", "NOT_CONFIGURED"].includes(code) ? "CONFIGURATION_REQUIRED" : "FAILED", error: code };
    }
  },
};

export const travelWebProvider = {
  isConfigured: () => webAdapter.isConfigured(),
  formatAsUntrustedContext: webAdapter.formatAsUntrustedContext.bind(webAdapter),
  search: (query: string, options?: { maxResults?: number; searchDepth?: "basic" | "advanced" }, parentSignal?: AbortSignal) => capabilityRuntime.call("web", "system", (signal) => webAdapter.search(query, options, parentSignal ? AbortSignal.any([signal, parentSignal]) : signal)),
  extract: (urls: string[]) => capabilityRuntime.call("web", "system", (signal) => webAdapter.extract(urls, signal)),
};

export const aiProvider = {
  isConfigured: () => aiAdapter.isConfigured(),
  async reviewOffer(input: OfferReviewRequest) {
    try {
      return await capabilityRuntime.call("ai", "system", async (signal) => {
        const result = await aiAdapter.reviewOffer(input, signal);
        if (result.reviewedBy === "deterministic_rules") throw new CapabilityError("PROVIDER_UNAVAILABLE");
        return result;
      });
    } catch { capabilityRuntime.recordFallback("ai"); return aiAdapter.deterministicOfferReview(input); }
  },
  async assistOfferDraft(input: OfferDraftAssistRequest) {
    try {
      return await capabilityRuntime.call("ai", "system", async (signal) => {
        const result = await aiAdapter.assistOfferDraft(input, signal);
        if (result.assistedBy === "deterministic_rules") throw new CapabilityError("PROVIDER_UNAVAILABLE");
        return result;
      });
    } catch { capabilityRuntime.recordFallback("ai"); return aiAdapter.deterministicDraftAssist(input); }
  },
  async classifyRisk(input: string) {
    try { return await capabilityRuntime.call("ai", "system", (signal) => aiAdapter.classifyRisk(input, signal)); }
    catch { capabilityRuntime.recordFallback("ai"); return (aiAdapter.isConfigured() || /(?:https?:|whatsapp|pay)/i.test(input) ? "MEDIUM" : "LOW") as "MEDIUM" | "LOW"; }
  },
  async synthesizeTravelIntel(input: { question: string; untrustedWebContext: string }) {
    try { return await capabilityRuntime.call("ai", "system", (signal) => aiAdapter.synthesizeTravelIntel(input, signal)); }
    catch { capabilityRuntime.recordFallback("ai"); return { answer: "لا يمكن تأكيد الإجابة الآن. راجع المصدر الرسمي قبل اتخاذ قرار السفر.", sourcesUsed: [] as string[], confidence: "LOW" as const }; }
  },
};

export async function searchFlights(input: FlightSearchInput): Promise<SupplierSearchResult> {
  try {
    return await capabilityRuntime.call("flights", "system", async (signal) => {
      const { amadeusSupplier } = await import("@/lib/travel-suppliers/amadeus");
      const result = await amadeusSupplier.searchFlights(input, signal);
      if (!result.connected || result.error) throw new CapabilityError("PROVIDER_UNAVAILABLE");
      return result;
    });
  } catch (error) {
    const code = error instanceof CapabilityError ? error.code : "PROVIDER_UNAVAILABLE";
    return { provider: "Amadeus Self-Service", configured: Boolean(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET), connected: false, checkedAt: new Date().toISOString(), offers: [], warnings: ["البحث لدى المورد غير متاح الآن؛ لا توجد أسعار حية مؤكدة."], error: code };
  }
}

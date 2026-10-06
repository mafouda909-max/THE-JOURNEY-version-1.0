import { resolveSilaAiRuntimeGateFromEnv, type SilaAiRuntimeGateResult } from "./sila-ai-runtime-gate";
import { resolveSilaCostRuntimeGuard, type SilaCostRuntimeGuardResult } from "./sila-cost-runtime-guard";
import { buildSilaAgentRoutingMatrix, resolveSilaModelProviders, type SilaModelProvider } from "./sila-model-router";

export type SilaRuntimeCapability =
  | "LOGIC_ONLY"
  | "PILOT_AI_DRAFTS"
  | "PAID_AI_ALLOWED"
  | "BACKGROUND_CALLS_ALLOWED"
  | "WORLD_RESEARCH_REQUIRES_EVIDENCE";

export interface SilaRuntimeProviderSummary {
  provider: SilaModelProvider;
  configured: boolean;
  role: "primary" | "reviewer" | "gateway" | "fallback";
  pilotEligible: boolean;
  missingEnv: string[];
}

export interface SilaRuntimeStatusResult {
  service: "sila-runtime-status";
  aiRuntime: SilaAiRuntimeGateResult;
  costGuard: SilaCostRuntimeGuardResult;
  providers: SilaRuntimeProviderSummary[];
  routing: {
    totalAgents: number;
    readyAgents: number;
    blockedAgents: number;
    statuses: string[];
  };
  capabilities: SilaRuntimeCapability[];
  canDraftWithAi: boolean;
  canUsePaidAi: boolean;
  canRunBackgroundCalls: boolean;
  missing: string[];
  blockers: string[];
  guardrails: string[];
  publicSummary: string;
}

export function resolveSilaRuntimeStatus(env: NodeJS.ProcessEnv = process.env): SilaRuntimeStatusResult {
  const aiRuntime = resolveSilaAiRuntimeGateFromEnv(env);
  const costGuard = resolveSilaCostRuntimeGuard(env);
  const providers = resolveSilaModelProviders(env).map((provider) => ({
    provider: provider.provider,
    configured: provider.configured,
    role: provider.role,
    pilotEligible: provider.pilotEligible,
    missingEnv: provider.missingEnv,
  }));
  const routingMatrix = buildSilaAgentRoutingMatrix(env);
  const readyAgents = routingMatrix.filter((decision) => decision.status !== "BLOCKED").length;
  const blockedAgents = routingMatrix.length - readyAgents;
  const canDraftWithAi = aiRuntime.canCallModel && (costGuard.canUsePilotAi || costGuard.canUsePaidAi);
  const canUsePaidAi = aiRuntime.canCallModel && costGuard.canUsePaidAi;
  const canRunBackgroundCalls = aiRuntime.canCallModel && costGuard.canRunAutomatically;
  const capabilities: SilaRuntimeCapability[] = ["WORLD_RESEARCH_REQUIRES_EVIDENCE"];

  if (!canDraftWithAi) capabilities.push("LOGIC_ONLY");
  if (costGuard.canUsePilotAi) capabilities.push("PILOT_AI_DRAFTS");
  if (canUsePaidAi) capabilities.push("PAID_AI_ALLOWED");
  if (canRunBackgroundCalls) capabilities.push("BACKGROUND_CALLS_ALLOWED");

  const missing = Array.from(new Set([...aiRuntime.missing, ...costGuard.missing]));
  const blockers = Array.from(new Set([...costGuard.blockers]));
  const guardrails = Array.from(new Set([...aiRuntime.guardrails, ...costGuard.guardrails]));

  return {
    service: "sila-runtime-status",
    aiRuntime,
    costGuard,
    providers,
    routing: {
      totalAgents: routingMatrix.length,
      readyAgents,
      blockedAgents,
      statuses: Array.from(new Set(routingMatrix.map((decision) => decision.status))),
    },
    capabilities,
    canDraftWithAi,
    canUsePaidAi,
    canRunBackgroundCalls,
    missing,
    blockers,
    guardrails,
    publicSummary: buildPublicSummary(canDraftWithAi, canUsePaidAi, canRunBackgroundCalls, costGuard.tier),
  };
}

function buildPublicSummary(canDraftWithAi: boolean, canUsePaidAi: boolean, canRunBackgroundCalls: boolean, tier: string) {
  if (!canDraftWithAi) {
    return "صلة تعمل الآن بقواعد وذاكرة ومنطق آمن فقط؛ لا توجد model calls مفعلة.";
  }
  if (canUsePaidAi) {
    return canRunBackgroundCalls
      ? `صلة تعمل في ${tier} مع AI مدفوع وbackground calls مسموحة ضمن الميزانية.`
      : `صلة تعمل في ${tier} مع AI مدفوع، لكن background calls مقفولة.`;
  }
  return "صلة تعمل في Pilot AI للمسودات والتحليل فقط؛ القرارات النهائية والعروض تحتاج مراجعة بشرية ومصادر.";
}

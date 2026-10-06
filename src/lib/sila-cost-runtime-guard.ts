import { resolveSilaProviderRuntime } from "./sila-provider-runtime";

export type SilaCostTier = "pilot" | "standard" | "production";

export interface SilaCostRuntimeGuardEnv {
  SILA_AI_TIER?: string | null;
  SILA_AI_MODE?: string | null;
  SILA_AI_ALLOW_PAID_CALLS?: string | null;
  SILA_AI_ALLOW_BACKGROUND_CALLS?: string | null;
  SILA_AI_MONTHLY_BUDGET_USD?: string | null;
  SILA_AI_MONTHLY_BUDGET_EGP?: string | null;
  OPENAI_API_KEY?: string | null;
  ANTHROPIC_API_KEY?: string | null;
  VERCEL_AI_GATEWAY_API_KEY?: string | null;
  VERCEL_AI_GATEWAY_KEY?: string | null;
  AI_GATEWAY_API_KEY?: string | null;
  VERCEL_OIDC_TOKEN?: string | null;
  SILA_VERCEL_GATEWAY_ENABLED?: string | null;
  OPENROUTER_API_KEY?: string | null;
}

export interface SilaCostRuntimeGuardResult {
  tier: SilaCostTier;
  hasAnyProviderKey: boolean;
  hasPilotProviderKey: boolean;
  hasPaidProviderKey: boolean;
  paidCallsAllowed: boolean;
  backgroundCallsAllowed: boolean;
  canUsePilotAi: boolean;
  canUsePaidAi: boolean;
  canRunAutomatically: boolean;
  budget: {
    usd: number | null;
    egp: number | null;
  };
  missing: string[];
  blockers: string[];
  guardrails: string[];
}

function readCostRuntimeEnv(): SilaCostRuntimeGuardEnv {
  return {
    SILA_AI_TIER: process.env.SILA_AI_TIER,
    SILA_AI_MODE: process.env.SILA_AI_MODE,
    SILA_AI_ALLOW_PAID_CALLS: process.env.SILA_AI_ALLOW_PAID_CALLS,
    SILA_AI_ALLOW_BACKGROUND_CALLS: process.env.SILA_AI_ALLOW_BACKGROUND_CALLS,
    SILA_AI_MONTHLY_BUDGET_USD: process.env.SILA_AI_MONTHLY_BUDGET_USD,
    SILA_AI_MONTHLY_BUDGET_EGP: process.env.SILA_AI_MONTHLY_BUDGET_EGP,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    VERCEL_AI_GATEWAY_API_KEY: process.env.VERCEL_AI_GATEWAY_API_KEY,
    VERCEL_AI_GATEWAY_KEY: process.env.VERCEL_AI_GATEWAY_KEY,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    VERCEL_OIDC_TOKEN: process.env.VERCEL_OIDC_TOKEN,
    SILA_VERCEL_GATEWAY_ENABLED: process.env.SILA_VERCEL_GATEWAY_ENABLED,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  };
}

function truthy(value: string | null | undefined) {
  return value === "true" || value === "1" || value === "yes";
}

function parseBudget(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function resolveTier(env: SilaCostRuntimeGuardEnv): SilaCostTier {
  const raw = env.SILA_AI_TIER ?? env.SILA_AI_MODE;
  if (raw === "production" || raw === "standard" || raw === "pilot") return raw;
  if (raw === "free") return "pilot";
  return "pilot";
}

export function resolveSilaCostRuntimeGuard(
  env: SilaCostRuntimeGuardEnv = readCostRuntimeEnv(),
): SilaCostRuntimeGuardResult {
  const tier = resolveTier(env);
  const paidCallsAllowed = truthy(env.SILA_AI_ALLOW_PAID_CALLS);
  const backgroundCallsAllowed = truthy(env.SILA_AI_ALLOW_BACKGROUND_CALLS);
  const providerRuntime = resolveSilaProviderRuntime(env);
  const hasPilotProviderKey =
    providerRuntime.openrouter.ready || providerRuntime.vercelGateway.ready;
  const hasPaidProviderKey = providerRuntime.openai.ready;
  const hasAnyProviderKey = hasPilotProviderKey || hasPaidProviderKey;
  const budgetUsd = parseBudget(env.SILA_AI_MONTHLY_BUDGET_USD);
  const budgetEgp = parseBudget(env.SILA_AI_MONTHLY_BUDGET_EGP);
  const hasBudget = budgetUsd !== null || budgetEgp !== null;
  const blockers: string[] = [];
  const missing: string[] = [];

  if (!hasAnyProviderKey) {
    blockers.push("لا يوجد أي مفتاح AI مفعّل؛ صلة تعمل logic فقط بدون model calls.");
    missing.push("OPENROUTER_API_KEY أو VERCEL_AI_GATEWAY_API_KEY أو OPENAI_API_KEY");
  }

  if (
    providerRuntime.vercelGateway.credentialPresent &&
    !providerRuntime.vercelGateway.ready &&
    !providerRuntime.vercelGateway.enabled
  ) {
    blockers.push("اعتماد Vercel AI Gateway موجود لكن الـGateway غير مفعّل للتنفيذ.");
    missing.push("SILA_VERCEL_GATEWAY_ENABLED=true");
  }

  if (
    providerRuntime.anthropic.credentialPresent &&
    !providerRuntime.anthropic.adapterAvailable
  ) {
    blockers.push("ANTHROPIC_API_KEY موجود لكن لا يوجد Anthropic adapter مباشر قابل للتنفيذ بعد.");
    missing.push("Anthropic direct adapter is not wired");
  }

  if (tier === "pilot" && !hasPilotProviderKey) {
    blockers.push("Pilot tier يحتاج مفتاحًا تجريبيًا/بوابة مثل Vercel AI Gateway أو OpenRouter.");
    missing.push("VERCEL_AI_GATEWAY_API_KEY أو OPENROUTER_API_KEY");
  }

  if ((tier === "standard" || tier === "production") && hasPaidProviderKey && !paidCallsAllowed) {
    blockers.push("المفاتيح المدفوعة موجودة لكن التشغيل المدفوع مقفول حتى يتم ضبط SILA_AI_ALLOW_PAID_CALLS=true.");
    missing.push("SILA_AI_ALLOW_PAID_CALLS=true");
  }

  if ((tier === "standard" || tier === "production") && paidCallsAllowed && !hasBudget) {
    blockers.push("التشغيل المدفوع يحتاج حد ميزانية واضح مثل SILA_AI_MONTHLY_BUDGET_USD أو SILA_AI_MONTHLY_BUDGET_EGP.");
    missing.push("SILA_AI_MONTHLY_BUDGET_USD أو SILA_AI_MONTHLY_BUDGET_EGP");
  }

  const canUsePilotAi = tier === "pilot" && hasPilotProviderKey;
  const canUsePaidAi =
    (tier === "standard" || tier === "production") && hasPaidProviderKey && paidCallsAllowed && hasBudget;

  return {
    tier,
    hasAnyProviderKey,
    hasPilotProviderKey,
    hasPaidProviderKey,
    paidCallsAllowed,
    backgroundCallsAllowed,
    canUsePilotAi,
    canUsePaidAi,
    canRunAutomatically: backgroundCallsAllowed && (canUsePilotAi || canUsePaidAi),
    budget: {
      usd: budgetUsd,
      egp: budgetEgp,
    },
    missing: Array.from(new Set(missing)),
    blockers,
    guardrails: [
      "لا يتم تشغيل model calls في الخلفية إلا إذا كان SILA_AI_ALLOW_BACKGROUND_CALLS=true.",
      "وجود مفتاح مدفوع لا يكفي للتشغيل؛ يجب ضبط SILA_AI_ALLOW_PAID_CALLS=true وحد ميزانية.",
      "عند انتهاء الاشتراك أو حذف المفتاح، تعود صلة إلى deterministic logic بدل الفشل أو السحب العشوائي.",
      "Pilot tier للمسودات والتحليل فقط؛ لا قرار سفر نهائي ولا نشر/تعديل عروض.",
      "لا يتم حفظ أو طباعة مفاتيح API في logs أو رسائل المستخدم.",
    ],
  };
}

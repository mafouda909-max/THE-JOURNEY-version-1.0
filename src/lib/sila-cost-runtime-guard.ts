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
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  };
}

function truthy(value: string | null | undefined) {
  return value === "true" || value === "1" || value === "yes";
}

function configured(value: string | null | undefined) {
  return Boolean(value?.trim());
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
  const hasPilotProviderKey = configured(env.OPENROUTER_API_KEY) || configured(env.VERCEL_AI_GATEWAY_API_KEY);
  const hasPaidProviderKey = configured(env.OPENAI_API_KEY) || configured(env.ANTHROPIC_API_KEY);
  const hasAnyProviderKey = hasPilotProviderKey || hasPaidProviderKey;
  const budgetUsd = parseBudget(env.SILA_AI_MONTHLY_BUDGET_USD);
  const budgetEgp = parseBudget(env.SILA_AI_MONTHLY_BUDGET_EGP);
  const hasBudget = budgetUsd !== null || budgetEgp !== null;
  const blockers: string[] = [];
  const missing: string[] = [];

  if (!hasAnyProviderKey) {
    blockers.push("لا يوجد أي مفتاح AI مفعّل؛ صلة تعمل logic فقط بدون model calls.");
    missing.push("OPENROUTER_API_KEY أو VERCEL_AI_GATEWAY_API_KEY أو OPENAI_API_KEY أو ANTHROPIC_API_KEY");
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

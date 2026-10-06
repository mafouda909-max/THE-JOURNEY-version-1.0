export type SilaAiRuntimeState = "ENABLED" | "NOT_CONFIGURED" | "DISABLED";

export type SilaAiRuntimeProvider = "openrouter" | "openai" | "anthropic" | "vercel_ai_gateway";

export interface SilaAiRuntimeGateInput {
  openRouterApiKey?: string | null;
  openAiApiKey?: string | null;
  anthropicApiKey?: string | null;
  vercelAiGatewayKey?: string | null;
  disabled?: boolean | null;
}

export interface SilaAiRuntimeGateResult {
  state: SilaAiRuntimeState;
  provider: SilaAiRuntimeProvider | null;
  canCallModel: boolean;
  publicLabel: string;
  missing: string[];
  guardrails: string[];
}

export function resolveSilaAiRuntimeGate(input: SilaAiRuntimeGateInput): SilaAiRuntimeGateResult {
  if (input.disabled) {
    return {
      state: "DISABLED",
      provider: null,
      canCallModel: false,
      publicLabel: "الذكاء الحي متوقف يدويًا.",
      missing: [],
      guardrails: [
        "لا تعرض ردودًا على أنها مولدة من نموذج حي.",
        "استخدم القواعد والذاكرة المحلية فقط حتى إعادة التفعيل.",
      ],
    };
  }

  if (input.vercelAiGatewayKey) {
    return enabled("vercel_ai_gateway");
  }
  if (input.openRouterApiKey) {
    return enabled("openrouter");
  }
  if (input.openAiApiKey) {
    return enabled("openai");
  }
  if (input.anthropicApiKey) {
    return enabled("anthropic");
  }

  return {
    state: "NOT_CONFIGURED",
    provider: null,
    canCallModel: false,
    publicLabel: "الذكاء الحي غير مفعّل بعد؛ صلة تعمل الآن بذاكرة وقواعد آمنة.",
    missing: ["AI provider API key", "model routing provider key"],
    guardrails: [
      "لا تدّعِ وجود AI حي في الواجهة قبل وجود مزود ومفتاح خادمي.",
      "أي معلومة سفر أو عرض يجب أن تبقى مصنفة: مؤكدة، تحتاج مصدر، أو غير متاحة.",
      "العروض لا تظهر إلا من مخزون صلة الحقيقي وبعد مراجعة الصلاحية.",
    ],
  };
}

function enabled(provider: SilaAiRuntimeGateResult["provider"]): SilaAiRuntimeGateResult {
  return {
    state: "ENABLED",
    provider,
    canCallModel: true,
    publicLabel: "الذكاء الحي مفعّل عبر مزود نماذج خادمي.",
    missing: [],
    guardrails: [
      "استخدم النموذج كمساعد قرار، وليس كمصدر رسمي وحده.",
      "اطلب المصادر عند شروط السفر أو صلاحية العروض.",
      "افصل دائمًا بين كلام المستخدم، استنتاج صلة، والمصدر الرسمي أو تأكيد الوكيل.",
    ],
  };
}

export function resolveSilaAiRuntimeGateFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return resolveSilaAiRuntimeGate({
    openRouterApiKey: env.OPENROUTER_API_KEY,
    openAiApiKey: env.OPENAI_API_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    vercelAiGatewayKey: env.VERCEL_AI_GATEWAY_API_KEY ?? env.AI_GATEWAY_API_KEY ?? env.VERCEL_AI_GATEWAY_KEY,
    disabled: env.SILA_AI_DISABLED === "1" || env.SILA_AI_DISABLED === "true",
  });
}

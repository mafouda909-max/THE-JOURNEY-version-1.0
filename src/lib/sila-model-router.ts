export type SilaModelProvider = "openai" | "anthropic" | "vercel_ai_gateway" | "openrouter";

export type SilaAiMode = "free" | "standard" | "production";

export type SilaAgentRole =
  | "ORCHESTRATOR"
  | "RESEARCH_AGENT"
  | "OFFER_AUDITOR"
  | "TRAVELER_ADVISOR"
  | "AGENT_COPILOT"
  | "QUALITY_GUARD";

export type SilaAgentTaskKind =
  | "ORCHESTRATE"
  | "WORLD_RESEARCH"
  | "OFFER_REVIEW"
  | "TRAVELER_ADVICE"
  | "AGENT_BRIEF"
  | "QUALITY_REVIEW";

export type SilaModelCapability =
  | "reasoning"
  | "tool_use"
  | "arabic"
  | "long_context"
  | "structured_output"
  | "grounded_research"
  | "risk_review";

export interface SilaModelRouterEnv {
  SILA_AI_MODE?: string | null;
  OPENAI_API_KEY?: string | null;
  ANTHROPIC_API_KEY?: string | null;
  VERCEL_AI_GATEWAY_API_KEY?: string | null;
  OPENROUTER_API_KEY?: string | null;
}

export interface SilaModelProviderState {
  provider: SilaModelProvider;
  configured: boolean;
  missingEnv: string[];
  role: "primary" | "reviewer" | "gateway" | "fallback";
  freeModeEligible: boolean;
  capabilityWeight: Partial<Record<SilaModelCapability, number>>;
}

export interface SilaAgentDefinition {
  role: SilaAgentRole;
  taskKind: SilaAgentTaskKind;
  purpose: string;
  requiredCapabilities: SilaModelCapability[];
  allowedTools: string[];
  forbiddenActions: string[];
  requiresHumanApprovalFor: string[];
}

export interface SilaModelRouteDecision {
  agent: SilaAgentDefinition;
  mode: SilaAiMode;
  selectedProvider: SilaModelProvider | null;
  status: "READY" | "BLOCKED" | "FALLBACK_READY" | "FREE_READY";
  missing: string[];
  reason: string;
  guardrails: string[];
  freeModeLimits: string[];
}

const PROVIDERS: SilaModelProviderState[] = [
  {
    provider: "openai",
    role: "primary",
    configured: false,
    missingEnv: ["OPENAI_API_KEY"],
    freeModeEligible: false,
    capabilityWeight: {
      reasoning: 5,
      tool_use: 5,
      arabic: 4,
      structured_output: 5,
      grounded_research: 4,
      risk_review: 5,
    },
  },
  {
    provider: "anthropic",
    role: "reviewer",
    configured: false,
    missingEnv: ["ANTHROPIC_API_KEY"],
    freeModeEligible: false,
    capabilityWeight: {
      reasoning: 5,
      long_context: 5,
      arabic: 4,
      structured_output: 4,
      risk_review: 5,
    },
  },
  {
    provider: "vercel_ai_gateway",
    role: "gateway",
    configured: false,
    missingEnv: ["VERCEL_AI_GATEWAY_API_KEY"],
    freeModeEligible: true,
    capabilityWeight: {
      tool_use: 4,
      structured_output: 4,
      grounded_research: 4,
      reasoning: 4,
    },
  },
  {
    provider: "openrouter",
    role: "fallback",
    configured: false,
    missingEnv: ["OPENROUTER_API_KEY"],
    freeModeEligible: true,
    capabilityWeight: {
      reasoning: 3,
      tool_use: 3,
      arabic: 3,
      structured_output: 3,
      long_context: 3,
    },
  },
];

export const SILA_AGENT_REGISTRY: SilaAgentDefinition[] = [
  {
    role: "ORCHESTRATOR",
    taskKind: "ORCHESTRATE",
    purpose: "يقسم طلب المستخدم إلى مهام ويختار الوكلاء والأدوات بالترتيب الصحيح.",
    requiredCapabilities: ["reasoning", "tool_use", "structured_output"],
    allowedTools: ["memory_recall", "mission_control", "model_router", "quality_gate"],
    forbiddenActions: ["تنفيذ دفع أو حجز", "نشر عرض عام", "تعديل بيانات عالية التأثير بدون موافقة"],
    requiresHumanApprovalFor: ["نشر عرض", "إرسال تأكيد نهائي للعميل", "إجراء مالي أو حجز"],
  },
  {
    role: "RESEARCH_AGENT",
    taskKind: "WORLD_RESEARCH",
    purpose: "يجمع معلومات السفر من مصادر رسمية أو مزودين موثوقين ويرجع evidence packet فقط.",
    requiredCapabilities: ["grounded_research", "structured_output", "risk_review"],
    allowedTools: ["official_source_search", "airline_policy_lookup", "travel_alert_lookup"],
    forbiddenActions: ["تحويل نتيجة بحث عامة إلى قرار نهائي", "اختراع رابط أو مصدر", "تجاهل تاريخ التحديث"],
    requiresHumanApprovalFor: ["اعتماد شرط فيزا جديد", "نشر تحذير عام", "تغيير سياسة منشورة"],
  },
  {
    role: "OFFER_AUDITOR",
    taskKind: "OFFER_REVIEW",
    purpose: "يراجع العروض والأسعار والصلاحية والتأكيد قبل الظهور أو التوصية.",
    requiredCapabilities: ["risk_review", "structured_output", "reasoning"],
    allowedTools: ["offer_intelligence", "agent_confirmation", "inventory_check"],
    forbiddenActions: ["اختراع سعر", "اعتبار عرض منتهي صالح", "تجاوز توثيق الوكيل"],
    requiresHumanApprovalFor: ["إيقاف عرض منشور", "إعادة نشر عرض موقوف", "تعديل سعر"],
  },
  {
    role: "TRAVELER_ADVISOR",
    taskKind: "TRAVELER_ADVICE",
    purpose: "يرد على المسافر بلغة بسيطة اعتمادًا على الذاكرة والمصادر المعتمدة فقط.",
    requiredCapabilities: ["arabic", "reasoning", "structured_output"],
    allowedTools: ["customer_memory", "readiness_brain", "safe_offer_match"],
    forbiddenActions: ["إعطاء قرار سفر نهائي بلا مصدر", "إظهار عرض غير مؤكد", "إخفاء النواقص"],
    requiresHumanApprovalFor: ["توصية حجز نهائية", "إرسال بيانات لجهة خارجية", "تأكيد عرض مالي"],
  },
  {
    role: "AGENT_COPILOT",
    taskKind: "AGENT_BRIEF",
    purpose: "يساعد الوكيل في تحويل كلام العميل إلى brief وسيناريو رد بدون افتراضات.",
    requiredCapabilities: ["arabic", "structured_output", "long_context"],
    allowedTools: ["customer_memory", "agent_brief", "missing_questions"],
    forbiddenActions: ["اختراع مستندات", "اختراع سعر", "إرسال رد كأنه تأكيد رسمي"],
    requiresHumanApprovalFor: ["إرسال عرض للعميل", "تأكيد السعر", "تغيير حالة فرصة تجارية"],
  },
  {
    role: "QUALITY_GUARD",
    taskKind: "QUALITY_REVIEW",
    purpose: "يراجع مخرجات صلة قبل عرضها ويمنع الهلوسة والمصادر والعروض الوهمية.",
    requiredCapabilities: ["risk_review", "structured_output", "reasoning"],
    allowedTools: ["trust_ledger", "claim_checker", "offer_policy_gate"],
    forbiddenActions: ["تمرير ادعاء بلا evidence", "تمرير عرض غير مؤكد", "تخفيف تحذير أمان مهم"],
    requiresHumanApprovalFor: ["تجاوز gate فاشل", "تغيير قرار عالي الأثر", "اعتماد معلومة متضاربة"],
  },
];

const FREE_MODE_LIMITS = [
  "Free mode للمسودات والتحليل وترتيب الأسئلة فقط، وليس قرار سفر نهائي.",
  "لا نشر أو تعديل عروض في Free mode بدون موافقة بشرية.",
  "لا اعتماد فيزا/ترانزيت/سعر نهائي من نموذج مجاني وحده.",
  "أي نتيجة من Free mode يجب أن تمر عبر Quality Guard وTrust Ledger.",
];

function readSilaModelRouterEnv(): SilaModelRouterEnv {
  return {
    SILA_AI_MODE: process.env.SILA_AI_MODE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    VERCEL_AI_GATEWAY_API_KEY: process.env.VERCEL_AI_GATEWAY_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  };
}

function resolveAiMode(env: SilaModelRouterEnv): SilaAiMode {
  if (env.SILA_AI_MODE === "free" || env.SILA_AI_MODE === "production" || env.SILA_AI_MODE === "standard") {
    return env.SILA_AI_MODE;
  }
  return "standard";
}

function configured(env: SilaModelRouterEnv, key: keyof SilaModelRouterEnv) {
  return Boolean(env[key]?.trim());
}

export function resolveSilaModelProviders(env: SilaModelRouterEnv = readSilaModelRouterEnv()): SilaModelProviderState[] {
  return PROVIDERS.map((provider) => {
    const isConfigured = provider.missingEnv.every((key) => configured(env, key as keyof SilaModelRouterEnv));
    return {
      ...provider,
      configured: isConfigured,
      missingEnv: isConfigured ? [] : provider.missingEnv,
    };
  });
}

function scoreProvider(provider: SilaModelProviderState, capabilities: SilaModelCapability[], mode: SilaAiMode) {
  const capabilityScore = capabilities.reduce((score, capability) => score + (provider.capabilityWeight[capability] ?? 0), 0);
  if (mode === "free" && provider.freeModeEligible) return capabilityScore + 2;
  if (mode === "free" && !provider.freeModeEligible) return -1;
  return capabilityScore;
}

function agentFor(role: SilaAgentRole) {
  const agent = SILA_AGENT_REGISTRY.find((candidate) => candidate.role === role);
  if (!agent) throw new Error(`Unknown Sila agent role: ${role}`);
  return agent;
}

export function routeSilaAgentModel(
  role: SilaAgentRole,
  env: SilaModelRouterEnv = readSilaModelRouterEnv(),
): SilaModelRouteDecision {
  const mode = resolveAiMode(env);
  const agent = agentFor(role);
  const providers = resolveSilaModelProviders(env);
  const configuredProviders = providers.filter((provider) => provider.configured);
  const eligibleProviders = mode === "free"
    ? configuredProviders.filter((provider) => provider.freeModeEligible)
    : configuredProviders;
  const selected = eligibleProviders
    .map((provider) => ({ provider, score: scoreProvider(provider, agent.requiredCapabilities, mode) }))
    .filter((candidate) => candidate.score >= 0)
    .sort((a, b) => b.score - a.score || providerTieBreak(a.provider) - providerTieBreak(b.provider))[0]?.provider;

  const anyFallback = configuredProviders.some((provider) => provider.role === "fallback");
  const status: SilaModelRouteDecision["status"] = selected
    ? mode === "free"
      ? "FREE_READY"
      : selected.role === "fallback"
        ? "FALLBACK_READY"
        : "READY"
    : "BLOCKED";

  const missing = selected
    ? []
    : mode === "free"
      ? providers.filter((provider) => provider.freeModeEligible).flatMap((provider) => provider.missingEnv)
      : providers.flatMap((provider) => provider.missingEnv);

  return {
    agent,
    mode,
    selectedProvider: selected?.provider ?? null,
    status,
    missing,
    reason: selected
      ? mode === "free"
        ? `تم اختيار ${selected.provider} لوكيل ${role} في Free Mode. المخرجات مسودات وتحليل فقط وليست قرارات نهائية.`
        : `تم اختيار ${selected.provider} لوكيل ${role} بناءً على القدرات المطلوبة: ${agent.requiredCapabilities.join(", ")}.`
      : anyFallback && mode !== "free"
        ? "يوجد fallback، لكن لم يطابق قدرات الوكيل المطلوبة."
        : mode === "free"
          ? "Free Mode يحتاج مفتاحًا مجانيًا/تجريبيًا مثل OPENROUTER_API_KEY أو VERCEL_AI_GATEWAY_API_KEY داخل Vercel، وليس داخل الشات."
          : "لا يوجد مزود AI مفعّل لهذا الوكيل؛ أضف مفاتيح المزودين في Vercel بدل تمريرها داخل الكود أو الشات.",
    guardrails: [
      "لا يتم تمرير مفاتيح API في الرسائل أو السجلات.",
      "كل tool خارجي يجب أن يرجع evidence packet أو يفشل مغلقًا.",
      "أي قرار سفر أو عرض عالي التأثير يحتاج human approval.",
      ...(mode === "free" ? FREE_MODE_LIMITS : []),
      ...agent.forbiddenActions.map((action) => `ممنوع: ${action}`),
    ],
    freeModeLimits: mode === "free" ? FREE_MODE_LIMITS : [],
  };
}

function providerTieBreak(provider: SilaModelProviderState) {
  return { primary: 0, gateway: 1, reviewer: 2, fallback: 3 }[provider.role];
}

export function buildSilaAgentRoutingMatrix(env: SilaModelRouterEnv = readSilaModelRouterEnv()) {
  return SILA_AGENT_REGISTRY.map((agent) => routeSilaAgentModel(agent.role, env));
}

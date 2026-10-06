import { resolveSilaRuntimeStatus, type SilaRuntimeStatusEnv } from "./sila-runtime-status";

export type SilaActivationState = "ACTIVE" | "READY" | "BLOCKED" | "SAFE_OFF";

export interface SilaActivationRequirement {
  key: string;
  expectation: string;
  satisfied: boolean;
  sensitive: boolean;
}

export interface SilaActivationTrack {
  id:
    | "zero_cost_pilot"
    | "gemini_context"
    | "guarded_paid_ai"
    | "background_ai"
    | "traveler_workspace";
  label: string;
  state: SilaActivationState;
  costClass: "zero_cost_route" | "provider_free_tier" | "paid_guarded" | "no_ai_cost";
  purpose: string;
  requirements: SilaActivationRequirement[];
  blockers: string[];
  warnings: string[];
  nextAction: string;
}

export interface SilaActivationManifest {
  service: "sila-activation-manifest";
  generatedAt: string;
  tracks: SilaActivationTrack[];
  counts: Record<SilaActivationState, number>;
  safeDefaults: string[];
  exactEnvNames: string[];
  secretsExposed: false;
}

function truthy(value: string | null | undefined) {
  return value === "true" || value === "1" || value === "yes";
}

function present(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function required(
  key: string,
  expectation: string,
  satisfied: boolean,
  sensitive = false,
): SilaActivationRequirement {
  return { key, expectation, satisfied, sensitive };
}

function stateFor(
  active: boolean,
  ready: boolean,
  blockers: string[],
  safeOff = false,
): SilaActivationState {
  if (active) return "ACTIVE";
  if (blockers.length > 0) return safeOff ? "SAFE_OFF" : "BLOCKED";
  if (ready) return "READY";
  return safeOff ? "SAFE_OFF" : "BLOCKED";
}

export function resolveSilaActivationManifest(
  env: SilaRuntimeStatusEnv = process.env,
  now = new Date(),
): SilaActivationManifest {
  const runtime = resolveSilaRuntimeStatus(env);
  const openrouterPresent = present(env.OPENROUTER_API_KEY);
  const geminiPresent =
    present(env.GEMINI_API_KEY) || present(env.GOOGLE_GENERATIVE_AI_API_KEY);
  const gatewayPresent =
    present(env.VERCEL_AI_GATEWAY_API_KEY) ||
    present(env.VERCEL_AI_GATEWAY_KEY) ||
    present(env.AI_GATEWAY_API_KEY) ||
    present(env.VERCEL_OIDC_TOKEN);
  const openAiPresent = present(env.OPENAI_API_KEY);
  const paidProviderPresent = gatewayPresent || openAiPresent;
  const tier = runtime.costGuard.tier;
  const paidFlag = truthy(env.SILA_AI_ALLOW_PAID_CALLS);
  const backgroundFlag = truthy(env.SILA_AI_ALLOW_BACKGROUND_CALLS);
  const hasBudget =
    runtime.costGuard.budget.usd !== null ||
    runtime.costGuard.budget.egp !== null;

  const pilotBlockers: string[] = [];
  if (!openrouterPresent) pilotBlockers.push("OPENROUTER_API_KEY غير موجود.");
  if (tier !== "pilot") pilotBlockers.push("SILA_AI_TIER ليس pilot.");
  const pilotWarnings: string[] = [];
  if (paidFlag) pilotWarnings.push("paid calls مفعلة رغم أن Pilot لا يحتاجها.");
  if (backgroundFlag) pilotWarnings.push("background calls مفعلة؛ الأفضل إبقاؤها مغلقة في Pilot.");

  const zeroCostPilot: SilaActivationTrack = {
    id: "zero_cost_pilot",
    label: "Pilot مجاني — OpenRouter",
    state: stateFor(
      runtime.costGuard.canUsePilotAi && runtime.canDraftWithAi,
      openrouterPresent,
      pilotBlockers,
    ),
    costClass: "zero_cost_route",
    purpose: "تشغيل مستشار صلة الحي للمسودات عبر openrouter/free فقط بدون fallback مدفوع.",
    requirements: [
      required("OPENROUTER_API_KEY", "مفتاح خادمي صالح", openrouterPresent, true),
      required("SILA_AI_TIER", "pilot", tier === "pilot"),
      required(
        "SILA_OPENROUTER_PILOT_MODEL",
        "openrouter/free أو يترك فارغًا لاستخدام الافتراضي",
        !env.SILA_OPENROUTER_PILOT_MODEL || env.SILA_OPENROUTER_PILOT_MODEL === "openrouter/free",
      ),
    ],
    blockers: pilotBlockers,
    warnings: pilotWarnings,
    nextAction: openrouterPresent
      ? "شغّل Provider Health probe من لوحة الأدمن للتحقق من المفتاح بدون generation."
      : "أضف OPENROUTER_API_KEY في Vercel Production، ولا ترسله في الشات.",
  };

  const geminiReady = runtime.contextWorkers.gemini.state === "READY";
  const geminiBlockers: string[] = [];
  if (!geminiPresent) geminiBlockers.push("Gemini API key غير موجود.");
  if (!truthy(env.SILA_GEMINI_CONTEXT_ENABLED)) {
    geminiBlockers.push("SILA_GEMINI_CONTEXT_ENABLED غير مفعّل.");
  }
  const geminiContext: SilaActivationTrack = {
    id: "gemini_context",
    label: "Gemini Context Worker",
    state: stateFor(geminiReady, geminiPresent, geminiBlockers),
    costClass: "provider_free_tier",
    purpose: "تحليل مستندات عامة/منقحة وسياقات طويلة خلف Privacy Gate.",
    requirements: [
      required(
        "GEMINI_API_KEY",
        "أو GOOGLE_GENERATIVE_AI_API_KEY",
        geminiPresent,
        true,
      ),
      required(
        "SILA_GEMINI_CONTEXT_ENABLED",
        "true",
        truthy(env.SILA_GEMINI_CONTEXT_ENABLED),
      ),
      required(
        "SILA_GEMINI_CONTEXT_MODEL",
        runtime.contextWorkers.gemini.model,
        true,
      ),
    ],
    blockers: geminiBlockers,
    warnings: [
      "لا يسمح ببيانات المسافر الحساسة.",
      "Free tier ليس سعة إنتاج مضمونة ويخضع لسياسة المزود وحدوده.",
    ],
    nextAction: geminiPresent
      ? "فعّل SILA_GEMINI_CONTEXT_ENABLED=true ثم شغّل metadata probe من لوحة الأدمن."
      : "أضف GEMINI_API_KEY في Vercel Production ثم فعّل العامل.",
  };

  const paidBlockers: string[] = [];
  if (!paidProviderPresent) paidBlockers.push("لا يوجد OpenAI أو Vercel Gateway executable provider.");
  if (tier !== "standard" && tier !== "production") {
    paidBlockers.push("SILA_AI_TIER يجب أن يكون standard أو production.");
  }
  if (!paidFlag) paidBlockers.push("SILA_AI_ALLOW_PAID_CALLS مغلق.");
  if (!hasBudget) paidBlockers.push("لا يوجد حد ميزانية شهري.");
  const paidActive = runtime.canUsePaidAi && runtime.canDraftWithAi;

  const guardedPaid: SilaActivationTrack = {
    id: "guarded_paid_ai",
    label: "AI مدفوع محكوم",
    state: stateFor(
      paidActive,
      paidProviderPresent && hasBudget,
      paidBlockers,
      !paidFlag,
    ),
    costClass: "paid_guarded",
    purpose: "تشغيل OpenAI أو Vercel AI Gateway فقط مع إذن صريح وحد ميزانية.",
    requirements: [
      required(
        "OPENAI_API_KEY / VERCEL_AI_GATEWAY_API_KEY",
        "مزود واحد على الأقل",
        paidProviderPresent,
        true,
      ),
      required(
        "SILA_AI_TIER",
        "standard أو production",
        tier === "standard" || tier === "production",
      ),
      required("SILA_AI_ALLOW_PAID_CALLS", "true", paidFlag),
      required(
        "SILA_AI_MONTHLY_BUDGET_USD / EGP",
        "قيمة رقمية محددة",
        hasBudget,
      ),
    ],
    blockers: paidBlockers,
    warnings: [
      "Gateway credits أو أي free allowance لا تُعامل كضمان دائم لعدم التكلفة.",
      "لا يتم فتح paid calls لمجرد وجود المفتاح.",
    ],
    nextAction: paidFlag
      ? "راجع الميزانية وProvider Health قبل أي تشغيل فعلي."
      : "اتركه SAFE_OFF حتى تحتاج جودة/سعة إنتاج مدفوعة بشكل مقصود.",
  };

  const backgroundBlockers: string[] = [];
  if (!backgroundFlag) backgroundBlockers.push("SILA_AI_ALLOW_BACKGROUND_CALLS مغلق.");
  if (!runtime.costGuard.canUsePilotAi && !runtime.canUsePaidAi) {
    backgroundBlockers.push("لا يوجد مسار AI مسموح له بالتنفيذ.");
  }
  const background: SilaActivationTrack = {
    id: "background_ai",
    label: "Background AI",
    state: stateFor(
      runtime.canRunBackgroundCalls,
      runtime.costGuard.canUsePilotAi || runtime.canUsePaidAi,
      backgroundBlockers,
      !backgroundFlag,
    ),
    costClass: runtime.canUsePaidAi ? "paid_guarded" : "zero_cost_route",
    purpose: "تشغيل مهام AI دورية/خلفية فقط بعد فصل إذن الخلفية عن إذن الموديل.",
    requirements: [
      required("SILA_AI_ALLOW_BACKGROUND_CALLS", "true", backgroundFlag),
      required(
        "AI execution path",
        "Pilot أو Paid path مسموح",
        runtime.costGuard.canUsePilotAi || runtime.canUsePaidAi,
      ),
    ],
    blockers: backgroundBlockers,
    warnings: ["يفضل أن يظل SAFE_OFF حتى تظهر حاجة تشغيلية واضحة ومقاسة."],
    nextAction: "اترك الخلفية مغلقة افتراضيًا؛ افتحها فقط لمهمة محددة ومع observability.",
  };

  const workspaceEnabled = truthy(env.TRAVELER_WORKSPACE_ENABLED);
  const travelerWorkspace: SilaActivationTrack = {
    id: "traveler_workspace",
    label: "ذاكرة المسافر الدائمة",
    state: workspaceEnabled ? "ACTIVE" : "SAFE_OFF",
    costClass: "no_ai_cost",
    purpose: "حفظ Sila Memory v2 داخل الرحلة المملوكة للمستخدم بدل localStorage فقط.",
    requirements: [
      required("TRAVELER_WORKSPACE_ENABLED", "true بعد إثبات schema", workspaceEnabled),
      required("Production DB Contract", "traveler_saved_intents مثبت في Production", false),
    ],
    blockers: workspaceEnabled ? [] : ["Feature flag مغلق حتى إثبات Production schema."],
    warnings: [
      "لا تفعّل الفلاج اعتمادًا على DB health العام فقط.",
      "يجب إثبات traveler_saved_intents والأعمدة المطلوبة أولًا.",
    ],
    nextAction: "شغّل Production DB Contract؛ بعد نجاحه فقط فعّل TRAVELER_WORKSPACE_ENABLED=true.",
  };

  const tracks = [
    zeroCostPilot,
    geminiContext,
    guardedPaid,
    background,
    travelerWorkspace,
  ];

  const counts = tracks.reduce<Record<SilaActivationState, number>>(
    (acc, track) => {
      acc[track.state] += 1;
      return acc;
    },
    { ACTIVE: 0, READY: 0, BLOCKED: 0, SAFE_OFF: 0 },
  );

  const exactEnvNames = [
    "OPENROUTER_API_KEY",
    "SILA_AI_TIER",
    "SILA_OPENROUTER_PILOT_MODEL",
    "GEMINI_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "SILA_GEMINI_CONTEXT_ENABLED",
    "SILA_GEMINI_CONTEXT_MODEL",
    "VERCEL_AI_GATEWAY_API_KEY",
    "VERCEL_AI_GATEWAY_KEY",
    "AI_GATEWAY_API_KEY",
    "OPENAI_API_KEY",
    "SILA_VERCEL_GATEWAY_ENABLED",
    "SILA_AI_ALLOW_PAID_CALLS",
    "SILA_AI_ALLOW_BACKGROUND_CALLS",
    "SILA_AI_MONTHLY_BUDGET_USD",
    "SILA_AI_MONTHLY_BUDGET_EGP",
    "TRAVELER_WORKSPACE_ENABLED",
  ];

  return {
    service: "sila-activation-manifest",
    generatedAt: now.toISOString(),
    tracks,
    counts,
    safeDefaults: [
      "SILA_AI_TIER=pilot",
      "SILA_AI_ALLOW_PAID_CALLS=false",
      "SILA_AI_ALLOW_BACKGROUND_CALLS=false",
      "SILA_GEMINI_CONTEXT_ENABLED=false حتى إضافة المفتاح",
      "TRAVELER_WORKSPACE_ENABLED=false حتى إثبات schema",
    ],
    exactEnvNames,
    secretsExposed: false,
  };
}

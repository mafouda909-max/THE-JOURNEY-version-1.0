import { providerSignal } from "./provider-deadline";
import {
  readSilaProviderRuntimeEnv,
  resolveSilaProviderRuntime,
  type SilaProviderRuntimeEnv,
} from "./sila-provider-runtime";
import {
  resolveSilaGeminiContextRuntime,
  type SilaGeminiContextEnv,
} from "./sila-gemini-context";

export type SilaProviderHealthState =
  | "UNCONFIGURED"
  | "CONFIGURED_UNVERIFIED"
  | "VERIFIED"
  | "DEGRADED"
  | "INVALID_CREDENTIAL";

export interface SilaProviderHealthItem {
  provider: "openrouter" | "gemini" | "vercel_ai_gateway" | "openai";
  state: SilaProviderHealthState;
  configured: boolean;
  executable: boolean;
  checkedAt: string | null;
  activeProbeUsed: boolean;
  generationUsed: false;
  detail: string;
}

export interface SilaProviderHealthReport {
  service: "sila-provider-health";
  mode: "PASSIVE" | "ACTIVE_PROBE";
  generationCallsMade: 0;
  providers: SilaProviderHealthItem[];
  safeToActivateZeroCostPilot: boolean;
  safeToActivateGeminiContext: boolean;
  guardrails: string[];
}

export type SilaProviderHealthEnv = SilaProviderRuntimeEnv &
  SilaGeminiContextEnv & {
    SILA_AI_TIER?: string | null;
  };

export interface SilaProviderHealthDeps {
  fetchImpl?: typeof fetch;
  now?: Date;
}

function valid(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length >= 10 ? trimmed : null;
}

function passiveReport(
  env: SilaProviderHealthEnv,
): SilaProviderHealthReport {
  const runtime = resolveSilaProviderRuntime(env);
  const gemini = resolveSilaGeminiContextRuntime(env);

  const providers: SilaProviderHealthItem[] = [
    {
      provider: "openrouter",
      state: runtime.openrouter.ready ? "CONFIGURED_UNVERIFIED" : "UNCONFIGURED",
      configured: runtime.openrouter.credentialPresent,
      executable: runtime.openrouter.ready,
      checkedAt: null,
      activeProbeUsed: false,
      generationUsed: false,
      detail: runtime.openrouter.ready
        ? "OpenRouter credential موجود، لكن لم يتم تنفيذ probe خارجي."
        : "OpenRouter غير مهيأ.",
    },
    {
      provider: "gemini",
      state:
        gemini.state === "READY"
          ? "CONFIGURED_UNVERIFIED"
          : gemini.configured
            ? "CONFIGURED_UNVERIFIED"
            : "UNCONFIGURED",
      configured: gemini.configured,
      executable: gemini.state === "READY",
      checkedAt: null,
      activeProbeUsed: false,
      generationUsed: false,
      detail:
        gemini.state === "READY"
          ? `Gemini Context Worker مهيأ على ${gemini.model}، بدون probe خارجي.`
          : gemini.configured
            ? "Gemini credential موجود لكن Context Worker غير مفعّل."
            : "Gemini غير مهيأ.",
    },
    {
      provider: "vercel_ai_gateway",
      state: runtime.vercelGateway.ready ? "CONFIGURED_UNVERIFIED" : "UNCONFIGURED",
      configured: runtime.vercelGateway.credentialPresent,
      executable: runtime.vercelGateway.ready,
      checkedAt: null,
      activeProbeUsed: false,
      generationUsed: false,
      detail: runtime.vercelGateway.ready
        ? "Vercel AI Gateway مهيأ، لكن لا يتم generation لمجرد health check."
        : "Vercel AI Gateway غير مهيأ أو غير مفعّل.",
    },
    {
      provider: "openai",
      state: runtime.openai.ready ? "CONFIGURED_UNVERIFIED" : "UNCONFIGURED",
      configured: runtime.openai.credentialPresent,
      executable: runtime.openai.ready,
      checkedAt: null,
      activeProbeUsed: false,
      generationUsed: false,
      detail: runtime.openai.ready
        ? "OpenAI credential موجود، لكن لم يتم probe خارجي."
        : "OpenAI direct غير مهيأ.",
    },
  ];

  return {
    service: "sila-provider-health",
    mode: "PASSIVE",
    generationCallsMade: 0,
    providers,
    safeToActivateZeroCostPilot: runtime.openrouter.ready,
    safeToActivateGeminiContext: gemini.state === "READY",
    guardrails: [
      "Health checks لا تنفذ chat/completions أو generateContent.",
      "وجود credential لا يعني سماح مالي؛ Cost Guard يظل صاحب قرار التنفيذ.",
      "Pilot المجاني يعتمد على OpenRouter free route فقط.",
      "Gemini Context Worker يظل محجوبًا عن بيانات المسافر الحساسة.",
      "لا يتم إرجاع مفاتيح أو أرصدة أو أسرار في تقرير health.",
    ],
  };
}

function classifyProbeStatus(status: number): SilaProviderHealthState {
  if (status >= 200 && status < 300) return "VERIFIED";
  if (status === 401 || status === 403) return "INVALID_CREDENTIAL";
  return "DEGRADED";
}

async function probe(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<SilaProviderHealthState> {
  try {
    const response = await fetchImpl(input, {
      ...init,
      signal: providerSignal(init.signal ?? undefined, 8_000),
    });
    return classifyProbeStatus(response.status);
  } catch {
    return "DEGRADED";
  }
}

export function getSilaProviderHealthPassive(
  env: SilaProviderHealthEnv = {
    ...readSilaProviderRuntimeEnv(),
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    SILA_GEMINI_CONTEXT_ENABLED: process.env.SILA_GEMINI_CONTEXT_ENABLED,
    SILA_GEMINI_CONTEXT_MODEL: process.env.SILA_GEMINI_CONTEXT_MODEL,
    SILA_GEMINI_CONTEXT_MAX_CHARS: process.env.SILA_GEMINI_CONTEXT_MAX_CHARS,
    SILA_AI_TIER: process.env.SILA_AI_TIER,
  },
): SilaProviderHealthReport {
  return passiveReport(env);
}

export async function probeSilaProviderHealth(
  env: SilaProviderHealthEnv = {
    ...readSilaProviderRuntimeEnv(),
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    SILA_GEMINI_CONTEXT_ENABLED: process.env.SILA_GEMINI_CONTEXT_ENABLED,
    SILA_GEMINI_CONTEXT_MODEL: process.env.SILA_GEMINI_CONTEXT_MODEL,
    SILA_GEMINI_CONTEXT_MAX_CHARS: process.env.SILA_GEMINI_CONTEXT_MAX_CHARS,
    SILA_AI_TIER: process.env.SILA_AI_TIER,
  },
  deps: SilaProviderHealthDeps = {},
): Promise<SilaProviderHealthReport> {
  const base = passiveReport(env);
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = (deps.now ?? new Date()).toISOString();
  const gemini = resolveSilaGeminiContextRuntime(env);

  const providers = await Promise.all(
    base.providers.map(async (item): Promise<SilaProviderHealthItem> => {
      if (!item.configured) return item;

      if (item.provider === "openrouter") {
        const key = valid(env.OPENROUTER_API_KEY);
        if (!key) return item;
        const state = await probe(fetchImpl, "https://openrouter.ai/api/v1/key", {
          method: "GET",
          headers: { Authorization: `Bearer ${key}` },
        });
        return {
          ...item,
          state,
          checkedAt: now,
          activeProbeUsed: true,
          detail:
            state === "VERIFIED"
              ? "OpenRouter credential تم التحقق منه عبر endpoint غير توليدي."
              : "OpenRouter probe لم ينجح؛ لم يتم تنفيذ أي generation.",
        };
      }

      if (item.provider === "gemini") {
        const key =
          valid(env.GEMINI_API_KEY) ??
          valid(env.GOOGLE_GENERATIVE_AI_API_KEY);
        if (!key) return item;
        const state = await probe(
          fetchImpl,
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(gemini.model)}`,
          {
            method: "GET",
            headers: { "x-goog-api-key": key },
          },
        );
        return {
          ...item,
          state,
          checkedAt: now,
          activeProbeUsed: true,
          detail:
            state === "VERIFIED"
              ? `Gemini model metadata متاح لـ ${gemini.model} بدون generateContent.`
              : "Gemini metadata probe لم ينجح؛ لم يتم تنفيذ أي generation.",
        };
      }

      if (item.provider === "openai") {
        const key = valid(env.OPENAI_API_KEY);
        if (!key) return item;
        const state = await probe(fetchImpl, "https://api.openai.com/v1/models", {
          method: "GET",
          headers: { Authorization: `Bearer ${key}` },
        });
        return {
          ...item,
          state,
          checkedAt: now,
          activeProbeUsed: true,
          detail:
            state === "VERIFIED"
              ? "OpenAI credential تم التحقق منه عبر models endpoint بدون generation."
              : "OpenAI models probe لم ينجح؛ لم يتم تنفيذ أي generation.",
        };
      }

      // Vercel AI Gateway intentionally stays configured-unverified here.
      // We do not generate tokens merely to prove health.
      return {
        ...item,
        checkedAt: now,
        detail:
          "Gateway credential موجود؛ التحقق النشط غير التوليدي غير مفروض، لذلك يظل CONFIGURED_UNVERIFIED حتى أول call مسموح فعليًا.",
      };
    }),
  );

  const openrouter = providers.find((item) => item.provider === "openrouter");
  const geminiItem = providers.find((item) => item.provider === "gemini");

  return {
    ...base,
    mode: "ACTIVE_PROBE",
    providers,
    safeToActivateZeroCostPilot: openrouter?.state === "VERIFIED",
    safeToActivateGeminiContext:
      gemini.state === "READY" && geminiItem?.state === "VERIFIED",
  };
}

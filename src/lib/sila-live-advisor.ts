import {
  AIProvider,
  type SilaAdvisorDraftRequest,
  type SilaAdvisorDraftResponse,
} from "./providers/ai";
import type { SilaAdvisorBrainOutput } from "./sila-advisor-brain";
import type { SilaEvidenceReview } from "./sila-evidence-bridge";
import {
  resolveSilaProviderRuntime,
  type SilaProviderRuntimeState,
} from "./sila-provider-runtime";
import type { SilaRuntimeStatusResult } from "./sila-runtime-status";

export type SilaLiveAdvisorStatus = "AI_DRAFT" | "DETERMINISTIC";

export interface SilaLiveAdvisorResult extends SilaAdvisorDraftResponse {
  status: SilaLiveAdvisorStatus;
  attemptedAi: boolean;
  policy: "PILOT_ZERO_COST" | "PAID_GUARDED" | "LOGIC_ONLY";
  reason: string;
}

export interface SilaLiveAdvisorProvider {
  deterministicSilaAdvisorDraft(draft: SilaAdvisorDraftRequest): SilaAdvisorDraftResponse;
  assistSilaAdvisorDraft(
    draft: SilaAdvisorDraftRequest,
    options: { mode: "pilot_free" | "paid_guarded" },
    signal?: AbortSignal,
  ): Promise<SilaAdvisorDraftResponse>;
}

export interface SilaLiveAdvisorInput {
  brain: SilaAdvisorBrainOutput;
  evidenceReview: SilaEvidenceReview;
  runtimeStatus: SilaRuntimeStatusResult;
  signal?: AbortSignal;
}

export interface SilaLiveAdvisorDeps {
  provider?: SilaLiveAdvisorProvider;
  providerRuntime?: SilaProviderRuntimeState;
}

function buildDraftRequest(
  brain: SilaAdvisorBrainOutput,
  evidenceReview: SilaEvidenceReview,
): SilaAdvisorDraftRequest {
  return {
    headline: brain.headline,
    baseAnswer: brain.answer,
    audience: brain.audience,
    trustState: brain.trustState,
    missingQuestions: brain.missingQuestions.map((question) => question.question),
    nextActions: brain.nextActions.map((action) => action.label),
    evidenceStatus: evidenceReview.status,
    evidenceSummary: evidenceReview.summary,
    allowedEvidenceClaims: evidenceReview.packets
      .filter((packet) => packet.decisionGrade)
      .map((packet) => packet.statement),
  };
}

function deterministicResult(
  provider: SilaLiveAdvisorProvider,
  draft: SilaAdvisorDraftRequest,
  policy: SilaLiveAdvisorResult["policy"],
  reason: string,
): SilaLiveAdvisorResult {
  return {
    ...provider.deterministicSilaAdvisorDraft(draft),
    status: "DETERMINISTIC",
    attemptedAi: false,
    policy,
    reason,
  };
}

export async function renderSilaLiveAdvisor(
  input: SilaLiveAdvisorInput,
  deps: SilaLiveAdvisorDeps = {},
): Promise<SilaLiveAdvisorResult> {
  const provider = deps.provider ?? new AIProvider();
  const providerRuntime = deps.providerRuntime ?? resolveSilaProviderRuntime();
  const draft = buildDraftRequest(input.brain, input.evidenceReview);
  const tier = input.runtimeStatus.costGuard.tier;

  if (!input.runtimeStatus.canDraftWithAi) {
    return deterministicResult(
      provider,
      draft,
      "LOGIC_ONLY",
      "Runtime/Cost Guard لا يسمح model call لهذا الطلب.",
    );
  }

  if (tier === "pilot") {
    if (!providerRuntime.openrouter.ready) {
      return deterministicResult(
        provider,
        draft,
        "PILOT_ZERO_COST",
        "Pilot الحي مقيد بـ OpenRouter free route؛ Gateway أو مزود مدفوع لا يُستخدم تلقائيًا.",
      );
    }

    const result = await provider.assistSilaAdvisorDraft(
      draft,
      { mode: "pilot_free" },
      input.signal,
    );

    return {
      ...result,
      status: result.assistedBy === "deterministic_rules" ? "DETERMINISTIC" : "AI_DRAFT",
      attemptedAi: true,
      policy: "PILOT_ZERO_COST",
      reason:
        result.assistedBy === "deterministic_rules"
          ? "تمت محاولة Pilot AI لكن Quality/Facts Lock رجّع الرد deterministic."
          : "تمت صياغة الرد عبر OpenRouter free route مع Facts Lock وEvidence Gate.",
    };
  }

  if (!input.runtimeStatus.canUsePaidAi) {
    return deterministicResult(
      provider,
      draft,
      "PAID_GUARDED",
      "التشغيل المدفوع غير مسموح: يحتاج paid flag + budget + provider executable.",
    );
  }

  const result = await provider.assistSilaAdvisorDraft(
    draft,
    { mode: "paid_guarded" },
    input.signal,
  );

  return {
    ...result,
    status: result.assistedBy === "deterministic_rules" ? "DETERMINISTIC" : "AI_DRAFT",
    attemptedAi: true,
    policy: "PAID_GUARDED",
    reason:
      result.assistedBy === "deterministic_rules"
        ? "تمت محاولة AI مدفوع لكن Facts Lock أعاد الرد deterministic."
        : "تمت صياغة الرد عبر provider مسموح ضمن Cost Guard وEvidence Gate.",
  };
}

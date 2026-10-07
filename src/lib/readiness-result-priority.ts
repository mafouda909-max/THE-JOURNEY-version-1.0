import type { ReadinessResponse } from "./readiness-contract";

export type ReadinessPriorityTone = "critical" | "warning" | "info" | "success";

export interface TravelerExecutiveSummary {
  verdictLabel: string;
  verdictTone: ReadinessPriorityTone;
  verdictExplanation: string;
  primaryRisk: string;
  checkedAt: string | null;
  liveResearchLabel: string;
  matchingOffersLabel: string;
  counts: {
    blockers: number;
    needsAction: number;
    needsConfirmation: number;
    confirmed: number;
    warnings: number;
    missingInformation: number;
    conflicts: number;
    matchingOffers: number;
  };
}

export interface ReadinessPriorityAction {
  id: string;
  tone: ReadinessPriorityTone;
  label: string;
  title: string;
  body: string;
  nextAction: string;
}

const RESEARCH_LABEL = {
  AVAILABLE: "بحث مباشر متاح ومُرفق بالمصادر",
  SOURCES_ONLY: "مصادر مباشرة وُجدت لكن بدون تلخيص كافٍ",
  NOT_CONFIGURED: "البحث المباشر غير مفعّل الآن",
  UNAVAILABLE: "البحث المباشر تعذر مؤقتًا",
} as const;

const OFFER_LABEL = {
  AVAILABLE: "توجد عروض صلة مطابقة داخل المنصة",
  NO_MATCH: "لا يوجد عرض منشور مطابق الآن",
  UNAVAILABLE: "تعذر فحص العروض الآن",
} as const;

const unique = (items: ReadinessPriorityAction[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.label}:${item.title}:${item.body}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function buildTravelerExecutiveSummary(result: ReadinessResponse): TravelerExecutiveSummary {
  const advisor = result.advisor;
  const checklist = result.checklist ?? [];
  const dossierItems = advisor?.travelDossier.items ?? [];
  const conflicts = result.decisionDossier?.conflicts ?? [];
  const offers = advisor?.offers ?? [];

  const blockers = checklist.filter((item) => item.status === "BLOCKED").length;
  const checklistNeedsAction = checklist.filter((item) => item.status === "PENDING_ACTION").length;
  const checklistNeedsConfirmation = checklist.filter((item) => item.status === "PENDING_CONFIRMATION" || item.status === "UNKNOWN").length;
  const dossierNeedsAction = dossierItems.filter((item) => item.readinessState === "NEEDS_ACTION").length;
  const dossierNeedsConfirmation = dossierItems.filter((item) => item.requirementState === "TO_VERIFY" || item.readinessState === "NEEDS_TRAVELER_CONFIRMATION" || item.readinessState === "UNKNOWN").length;
  const confirmed = checklist.filter((item) => item.status === "VERIFIED").length + (advisor?.travelDossier.confirmedRequired.length ?? 0);

  const needsAction = checklistNeedsAction + dossierNeedsAction;
  const needsConfirmation = checklistNeedsConfirmation + dossierNeedsConfirmation;

  const verdictTone: ReadinessPriorityTone =
    result.status === "BLOCKED" || blockers > 0 || conflicts.length > 0
      ? "critical"
      : result.status === "NEEDS_ATTENTION" || needsAction > 0
        ? "warning"
        : result.status === "READY"
          ? "success"
          : "info";

  const verdictLabel =
    result.status === "BLOCKED"
      ? "لا تتحرك قبل حل المانع"
      : result.status === "NEEDS_ATTENTION"
        ? "ينفع تكمل، لكن عندك خطوات لازمة"
        : result.status === "NEEDS_CONFIRMATION"
          ? "القرار متوقف على تأكيدات ناقصة"
          : result.status === "READY"
            ? "جاهز ضمن ما تم فحصه"
            : "الصورة غير مكتملة بعد";

  const primaryRisk =
    conflicts[0] ??
    checklist.find((item) => item.status === "BLOCKED")?.title ??
    dossierItems.find((item) => item.readinessState === "NEEDS_ACTION")?.title ??
    dossierItems.find((item) => item.requirementState === "TO_VERIFY")?.title ??
    result.warnings[0] ??
    result.missingInformation[0] ??
    "لا يوجد مانع أول واضح، لكن النتيجة مرتبطة فقط بالمصادر والبنود المعروضة.";

  const verdictExplanation =
    verdictTone === "critical"
      ? "صلة وجدت مانعًا أو تعارضًا لا يصح دفنه داخل التفاصيل. عالج هذا أولًا ثم أعد الفحص."
      : verdictTone === "warning"
        ? "الصورة مفيدة، لكن هناك إجراءات عملية أو مستندات ناقصة قبل الاعتماد على الرحلة."
        : verdictTone === "success"
          ? "المعروض لا يعني ضمان دخول أو سفر، لكنه يعني أن البنود المفحوصة لا تُظهر مانعًا حاليًا."
          : "نحتاج سياقًا أو مصدرًا أقوى قبل إعطاء قرار نهائي.";

  return {
    verdictLabel,
    verdictTone,
    verdictExplanation,
    primaryRisk,
    checkedAt: result.evaluatedAt,
    liveResearchLabel: advisor?.liveResearch.status
      ? RESEARCH_LABEL[advisor.liveResearch.status]
      : "لم تُعرض حالة بحث مباشر",
    matchingOffersLabel: advisor?.offerSearchStatus
      ? OFFER_LABEL[advisor.offerSearchStatus]
      : "لم تُعرض حالة عروض صلة",
    counts: {
      blockers,
      needsAction,
      needsConfirmation,
      confirmed,
      warnings: result.warnings.length,
      missingInformation: result.missingInformation.length,
      conflicts: conflicts.length,
      matchingOffers: offers.length,
    },
  };
}

export function selectReadinessPriorityActions(
  result: ReadinessResponse,
  limit = 5,
): ReadinessPriorityAction[] {
  const actions: ReadinessPriorityAction[] = [];

  for (const item of result.checklist ?? []) {
    if (item.status === "BLOCKED") {
      actions.push({
        id: `checklist-blocked-${item.id}`,
        tone: "critical",
        label: "مانع",
        title: item.title,
        body: item.description,
        nextAction: item.nextAction,
      });
    } else if (item.status === "PENDING_ACTION") {
      actions.push({
        id: `checklist-action-${item.id}`,
        tone: "warning",
        label: "إجراء مطلوب",
        title: item.title,
        body: item.description,
        nextAction: item.nextAction,
      });
    } else if (item.status === "PENDING_CONFIRMATION" || item.status === "UNKNOWN") {
      actions.push({
        id: `checklist-confirm-${item.id}`,
        tone: "info",
        label: "تأكيد ناقص",
        title: item.title,
        body: item.description,
        nextAction: item.nextAction,
      });
    }
  }

  for (const item of result.advisor?.travelDossier.items ?? []) {
    if (item.readinessState === "NEEDS_ACTION") {
      actions.push({
        id: `dossier-action-${item.id}`,
        tone: "warning",
        label: "تجهيز ناقص",
        title: item.title,
        body: item.why,
        nextAction: item.nextAction,
      });
    } else if (
      item.requirementState === "TO_VERIFY" ||
      item.readinessState === "NEEDS_TRAVELER_CONFIRMATION" ||
      item.readinessState === "UNKNOWN"
    ) {
      actions.push({
        id: `dossier-confirm-${item.id}`,
        tone: "info",
        label: "يحتاج تأكيد",
        title: item.title,
        body: item.why,
        nextAction: item.nextAction,
      });
    }
  }

  const route = result.advisor?.routeIntelligence;
  if (route && route.status !== "NOT_APPLICABLE") {
    for (const factor of route.factors) {
      if (factor.state === "COMPLEXITY" || factor.state === "UNKNOWN") {
        actions.push({
          id: `route-${factor.id}`,
          tone: factor.state === "COMPLEXITY" ? "warning" : "info",
          label: "مسار/ترانزيت",
          title: factor.label,
          body: factor.detail,
          nextAction: factor.nextAction,
        });
      }
    }
  }

  for (const [index, question] of (result.advisor?.questionsToComplete ?? []).entries()) {
    actions.push({
      id: `advisor-question-${index}`,
      tone: "info",
      label: "سؤال ناقص",
      title: "بيان يحسن دقة القرار",
      body: question,
      nextAction: "أجب عنه ثم أعد الفحص بدل الاعتماد على نتيجة ناقصة.",
    });
  }

  for (const [index, info] of result.missingInformation.entries()) {
    actions.push({
      id: `missing-${index}`,
      tone: "info",
      label: "معلومة ناقصة",
      title: "أكمل هذا البيان",
      body: info,
      nextAction: "أضفه في بيانات الرحلة ثم أعد الفحص.",
    });
  }

  for (const offer of result.advisor?.offers ?? []) {
    actions.push({
      id: `offer-${offer.id}`,
      tone: "success",
      label: "عرض مطابق",
      title: offer.title,
      body: `${offer.destination} · ${offer.agentName}`,
      nextAction: offer.confirmationNeeded.length
        ? offer.confirmationNeeded.join(" ")
        : "راجع العرض وافتح الاستفسار من صلة إذا كان مناسبًا.",
    });
  }

  return unique(actions).slice(0, Math.max(1, limit));
}

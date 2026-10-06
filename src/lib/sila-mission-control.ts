import { buildSilaAdvisorBrain, type SilaAdvisorBrainResult } from "./sila-advisor-brain";
import { resolveSilaAiRuntimeGate, type SilaAiRuntimeGateResult } from "./sila-ai-runtime-gate";
import { reviewSilaOfferIntelligence, type SilaOfferReviewInput, type SilaOfferReviewResult } from "./sila-offer-intelligence";
import type { SilaTravelCaseSnapshot } from "./sila-advisor-travel-case";

export type SilaMissionKind =
  | "ANSWER_TRAVELER"
  | "QUALIFY_CLIENT"
  | "REVIEW_OFFER"
  | "RECONFIRM_OFFER"
  | "SUSPEND_OFFER"
  | "REQUEST_SOURCE"
  | "PREPARE_AGENT_BRIEF"
  | "ACTIVATE_AI_RUNTIME";

export interface SilaMissionTask {
  id: string;
  kind: SilaMissionKind;
  title: string;
  why: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  owner: "sila" | "agent" | "admin" | "traveler";
  blockedBy?: string[];
}

export interface SilaMissionControlInput {
  travelCase?: SilaTravelCaseSnapshot | null;
  offers?: SilaOfferReviewInput[] | null;
  aiRuntime?: SilaAiRuntimeGateResult | null;
}

export interface SilaMissionControlResult {
  advisorBrain?: SilaAdvisorBrainResult | null;
  aiRuntime: SilaAiRuntimeGateResult;
  offerReviews: SilaOfferReviewResult[];
  tasks: SilaMissionTask[];
  commandSummary: string;
}

export function planSilaMissionControl(
  input: SilaMissionControlInput,
  now = new Date(),
): SilaMissionControlResult {
  const aiRuntime = input.aiRuntime ?? resolveSilaAiRuntimeGate({});
  const advisorBrain = input.travelCase ? buildSilaAdvisorBrain(input.travelCase) : null;
  const offerReviews = (input.offers ?? []).map((offer) => reviewSilaOfferIntelligence(offer, now));
  const tasks: SilaMissionTask[] = [];

  if (!aiRuntime.canCallModel) {
    tasks.push({
      id: "activate-ai-runtime",
      kind: "ACTIVATE_AI_RUNTIME",
      title: "فعّل AI Runtime الحقيقي",
      why: "صلة تعمل الآن بقواعد وذاكرة آمنة؛ الذكاء الحي يحتاج مزود ومفتاح ومسار خادمي قبل عرضه كـ AI فعلي.",
      priority: "HIGH",
      owner: "admin",
      blockedBy: aiRuntime.missing,
    });
  }

  if (advisorBrain) {
    tasks.push({
      id: advisorBrain.audience === "AGENT" ? "qualify-client" : "answer-traveler",
      kind: advisorBrain.audience === "AGENT" ? "QUALIFY_CLIENT" : "ANSWER_TRAVELER",
      title: advisorBrain.audience === "AGENT" ? "حوّل كلام العميل إلى ملف مؤهل" : "قدّم إجابة تنفيذية للمسافر",
      why: advisorBrain.answer,
      priority: "HIGH",
      owner: "sila",
    });

    if (advisorBrain.researchNeeds.length > 0) {
      tasks.push({
        id: "request-sources",
        kind: "REQUEST_SOURCE",
        title: "اجمع المصادر الرسمية أو تأكيد الوكيل",
        why: `يوجد ${advisorBrain.researchNeeds.length} عناصر تحتاج مصدرًا قبل تحويلها إلى قرار مؤكد.`,
        priority: "HIGH",
        owner: "sila",
        blockedBy: advisorBrain.researchNeeds.map((need) => need.label),
      });
    }

    if (advisorBrain.agentBrief) {
      tasks.push({
        id: "prepare-agent-brief",
        kind: "PREPARE_AGENT_BRIEF",
        title: "جهّز brief للوكيل بدون افتراضات",
        why: "العميل ظهر في وضع وكيل؛ صلة يجب أن تسلّم ملخصًا منظمًا لا يخترع أسعارًا أو شروط سفر.",
        priority: "MEDIUM",
        owner: "sila",
      });
    }
  }

  offerReviews.forEach((review, index) => {
    if (review.decision === "PUBLISHABLE") {
      tasks.push({
        id: `offer-${index}-reviewed`,
        kind: "REVIEW_OFFER",
        title: "عرض صالح للتوصية المشروطة",
        why: review.statusLabel,
        priority: "LOW",
        owner: "sila",
      });
      return;
    }

    if (review.decision === "EXPIRED" || review.decision === "SUSPEND" || review.decision === "INVALID") {
      tasks.push({
        id: `offer-${index}-suspend`,
        kind: "SUSPEND_OFFER",
        title: "أوقف عرضًا غير صالح قبل أن يضلل المستخدم",
        why: review.findings[0]?.message ?? review.statusLabel,
        priority: "HIGH",
        owner: "admin",
        blockedBy: review.findings.map((finding) => finding.action),
      });
      return;
    }

    tasks.push({
      id: `offer-${index}-reconfirm`,
      kind: "RECONFIRM_OFFER",
      title: "أعد تأكيد العرض قبل إبرازه",
      why: review.statusLabel,
      priority: "MEDIUM",
      owner: "agent",
      blockedBy: review.findings.map((finding) => finding.action),
    });
  });

  tasks.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));

  return {
    advisorBrain,
    aiRuntime,
    offerReviews,
    tasks,
    commandSummary: summarizeTasks(tasks),
  };
}

function priorityRank(priority: SilaMissionTask["priority"]) {
  return { HIGH: 0, MEDIUM: 1, LOW: 2 }[priority];
}

function summarizeTasks(tasks: SilaMissionTask[]) {
  if (tasks.length === 0) return "لا توجد مهام حرجة الآن؛ استمر في مراقبة المصادر والعروض.";
  const high = tasks.filter((task) => task.priority === "HIGH").length;
  const medium = tasks.filter((task) => task.priority === "MEDIUM").length;
  return `صلة لديها ${tasks.length} مهمة: ${high} عالية الأولوية و${medium} متوسطة. ابدأ بالأعلى قبل عرض أي توصية للمستخدم.`;
}

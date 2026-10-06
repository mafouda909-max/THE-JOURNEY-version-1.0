import { firstSilaAdvisorStep, type SilaAdvisorQuestion } from "./sila-advisor-intake";
import {
  summarizeSilaTravelCase,
  type SilaTravelCaseSnapshot,
} from "./sila-advisor-travel-case";

export type SilaAdvisorAudience = "TRAVELER" | "AGENT" | "MIXED";
export type SilaAdvisorTrustState = "LOCAL_ONLY" | "NEEDS_OFFICIAL_SOURCES" | "READY_FOR_HUMAN_REVIEW";

export interface SilaAdvisorAction {
  id: string;
  label: string;
  reason: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface SilaAdvisorResearchNeed {
  id: string;
  label: string;
  sourceClass: "official" | "airline" | "marketplace" | "agent";
  reason: string;
}

export interface SilaAdvisorAgentBrief {
  headline: string;
  customerContext: string[];
  knownTripFacts: string[];
  missingBeforeQuote: string[];
  doNotAssume: string[];
}

export interface SilaAdvisorBrainOutput {
  audience: SilaAdvisorAudience;
  headline: string;
  answer: string;
  trustState: SilaAdvisorTrustState;
  nextActions: SilaAdvisorAction[];
  researchNeeds: SilaAdvisorResearchNeed[];
  missingQuestions: SilaAdvisorQuestion[];
  agentBrief: SilaAdvisorAgentBrief | null;
  offerPolicy: string;
}

export type SilaAdvisorBrainResult = SilaAdvisorBrainOutput;

const purposeArabic: Record<string, string> = {
  tourism: "سياحة",
  study: "دراسة",
  work: "عمل",
  business: "رحلة عمل",
  freelance: "عمل حر أو عن بُعد",
  umrah: "عمرة",
  hajj: "حج",
  visit: "زيارة",
  medical: "علاج",
  transit: "ترانزيت",
};

function presentValue(value: string | null) {
  if (!value) return null;
  return purposeArabic[value] ?? value;
}

function knownFact(label: string, value: string | null) {
  const presented = presentValue(value);
  return presented ? `${label}: ${presented}` : null;
}

function compact(items: Array<string | null | undefined>) {
  return items.filter((item): item is string => Boolean(item));
}

function unique<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function hasAgentMemory(caseSnapshot: SilaTravelCaseSnapshot) {
  return (
    caseSnapshot.memory.agent.hasAgentIntent ||
    caseSnapshot.memory.agent.handledDestinations.length > 0 ||
    caseSnapshot.memory.agent.requestedBriefs > 0
  );
}

function detectAudience(caseSnapshot: SilaTravelCaseSnapshot): SilaAdvisorAudience {
  if (caseSnapshot.role === "AGENT" || hasAgentMemory(caseSnapshot)) return "AGENT";
  if (caseSnapshot.role === "UNKNOWN") return "MIXED";
  return "TRAVELER";
}

function buildResearchNeeds(caseSnapshot: SilaTravelCaseSnapshot): SilaAdvisorResearchNeed[] {
  const { fields } = caseSnapshot;
  const needs: SilaAdvisorResearchNeed[] = [];
  if (fields.destination.value && fields.nationality.value) {
    needs.push({
      id: "entry-rules",
      label: "تأكيد شروط الدخول/التأشيرة من مصدر رسمي",
      sourceClass: "official",
      reason: "الجنسية والوجهة معروفين، وأي نصيحة سفر لا تتحول لقرار قبل مصدر رسمي حديث.",
    });
  }
  if (
    fields.transit.value ||
    caseSnapshot.memory.preferences.transitConcern ||
    caseSnapshot.memory.traveler.constraints.some((constraint: string) => constraint.includes("ترانزيت"))
  ) {
    needs.push({
      id: "transit-risk",
      label: "فحص الترانزيت وشروط المطار/شركة الطيران",
      sourceClass: "airline",
      reason: "الترانزيت قد يغير قرار الرحلة حتى لو الوجهة نفسها مناسبة.",
    });
  }
  if (fields.destination.value && fields.dateWindow.value) {
    needs.push({
      id: "offer-match",
      label: "فحص عروض صلة المطابقة فقط إن وجدت",
      sourceClass: "marketplace",
      reason: "العروض يجب أن تظهر من مخزون حقيقي ومطابقة للوجهة والتوقيت، وليس كنص مولّد.",
    });
  }
  if (caseSnapshot.role === "AGENT" || hasAgentMemory(caseSnapshot)) {
    needs.push({
      id: "agent-quote-readiness",
      label: "مراجعة جاهزية الملف قبل إرسال عرض للعميل",
      sourceClass: "agent",
      reason: "الوكيل يحتاج ملفًا واضحًا قبل السعر: بيانات ناقصة، مخاطر، ونطاق العرض.",
    });
  }
  return unique(needs);
}

function buildNextActions(caseSnapshot: SilaTravelCaseSnapshot): SilaAdvisorAction[] {
  const summary = summarizeSilaTravelCase(caseSnapshot);
  const intent = {
    originalMessage: caseSnapshot.messages.at(-1)?.text ?? "",
    role: caseSnapshot.role,
    fields: caseSnapshot.fields,
  };
  const actions: SilaAdvisorAction[] = [];
  const firstQuestion = summary.missingQuestions[0];
  if (firstQuestion) {
    actions.push({
      id: `answer-${firstQuestion.id}`,
      label: firstQuestion.question,
      reason: firstQuestion.why,
      priority: "HIGH",
    });
  }
  actions.push({
    id: "advisor-first-step",
    label: firstSilaAdvisorStep(intent),
    reason: "ده أقرب توجيه عملي بناءً على الملف الحالي بدون ادعاء مصادر خارجية.",
    priority: "HIGH",
  });
  if (caseSnapshot.fields.destination.value && caseSnapshot.fields.purpose.value) {
    actions.push({
      id: "verify-official-rules",
      label: "ثبّت القواعد الرسمية قبل الحجز أو الرد النهائي",
      reason: "صلة تعرف نواقص الملف، لكن شروط الدول تحتاج مصدر رسمي حديث قبل القرار.",
      priority: "HIGH",
    });
  }
  if (hasAgentMemory(caseSnapshot)) {
    actions.push({
      id: "prepare-agent-brief",
      label: "حوّل الملف إلى brief للوكيل قبل التسعير",
      reason: "العميل/الوكيل محتاج رد منظم: المعروف، الناقص، المخاطر، وما لا يجب افتراضه.",
      priority: "MEDIUM",
    });
  }
  return unique(actions).slice(0, 5);
}

function buildKnownTripFacts(caseSnapshot: SilaTravelCaseSnapshot) {
  const { fields } = caseSnapshot;
  return compact([
    knownFact("الجنسية", fields.nationality.value),
    knownFact("الوجهة", fields.destination.value),
    knownFact("الغرض", fields.purpose.value),
    knownFact("التوقيت", fields.dateWindow.value),
    knownFact("المسافرون", fields.travelers.value),
    knownFact("الميزانية", fields.budget.value),
    knownFact("الانطلاق", fields.origin.value),
    knownFact("الجواز", fields.passportStatus.value),
    knownFact("الإقامة", fields.accommodation.value),
    knownFact("العودة", fields.returnTicket.value),
  ]);
}

function buildAgentBrief(caseSnapshot: SilaTravelCaseSnapshot): SilaAdvisorAgentBrief | null {
  const audience = detectAudience(caseSnapshot);
  if (audience === "TRAVELER" && !hasAgentMemory(caseSnapshot)) return null;
  const summary = summarizeSilaTravelCase(caseSnapshot);
  const priceSensitivity = caseSnapshot.memory.preferences.priceSensitivity;
  return {
    headline: caseSnapshot.title,
    customerContext: compact([
      priceSensitivity !== "UNKNOWN" ? `حساسية السعر: ${priceSensitivity}` : null,
      ...caseSnapshot.memory.traveler.interests.map((interest: string) => `اهتمام: ${interest}`),
      ...caseSnapshot.memory.traveler.constraints.map((constraint: string) => `قيد: ${constraint}`),
    ]),
    knownTripFacts: buildKnownTripFacts(caseSnapshot),
    missingBeforeQuote: summary.missingQuestions.map((question) => question.question),
    doNotAssume: [
      "لا تفترض وجود عرض مطابق قبل فحص المخزون الحقيقي.",
      "لا تقدم شرط تأشيرة نهائي بدون مصدر رسمي حديث.",
      "لا تعتبر الميزانية المحدودة رقمًا فعليًا قبل سؤال العميل عن الحد الأقصى.",
    ],
  };
}

function determineTrustState(caseSnapshot: SilaTravelCaseSnapshot): SilaAdvisorTrustState {
  if (caseSnapshot.fields.destination.value && caseSnapshot.fields.nationality.value) {
    return "NEEDS_OFFICIAL_SOURCES";
  }
  if (hasAgentMemory(caseSnapshot)) return "READY_FOR_HUMAN_REVIEW";
  return "LOCAL_ONLY";
}

export function buildSilaAdvisorBrain(caseSnapshot: SilaTravelCaseSnapshot): SilaAdvisorBrainOutput {
  const summary = summarizeSilaTravelCase(caseSnapshot);
  const audience = detectAudience(caseSnapshot);
  const researchNeeds = buildResearchNeeds(caseSnapshot);
  const nextActions = buildNextActions(caseSnapshot);
  const destination = caseSnapshot.fields.destination.value ?? "الوجهة غير محددة";
  const purpose = presentValue(caseSnapshot.fields.purpose.value) ?? "الغرض غير محدد";
  const answer =
    audience === "AGENT"
      ? `الملف الحالي يصلح كبداية brief للعميل: ${destination} — ${purpose}. قبل التسعير، ثبّت الناقص وراجع المصدر الرسمي.`
      : `الملف الحالي واضح كبداية: ${destination} — ${purpose}. الخطوة الصح الآن هي إكمال الناقص ثم فحص القواعد الرسمية قبل الحجز.`;

  return {
    audience,
    headline: summary.understanding,
    answer,
    trustState: determineTrustState(caseSnapshot),
    nextActions,
    researchNeeds,
    missingQuestions: summary.missingQuestions,
    agentBrief: buildAgentBrief(caseSnapshot),
    offerPolicy: "لا تظهر عروض صلة إلا من مخزون حقيقي ومطابق للوجهة والتوقيت والقيود؛ عند عدم وجود مطابق نقول ذلك صراحة.",
  };
}

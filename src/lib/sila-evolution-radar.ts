export type SilaEvolutionCategory =
  | "agent_runtime"
  | "model_routing"
  | "rag_memory"
  | "tool_registry"
  | "observability"
  | "human_approval"
  | "world_research";

export type SilaEvolutionDecision = "ADOPT_NOW" | "PILOT" | "WATCH" | "REJECT_FOR_NOW";

export interface SilaEvolutionCandidate {
  id: string;
  name: string;
  category: SilaEvolutionCategory;
  sourceKind: "official_sdk" | "open_source_repo" | "platform_feature" | "architecture_pattern";
  whyItHelpsSila: string;
  risks: string[];
  decision: SilaEvolutionDecision;
  nextStep: string;
}

export interface SilaLearningSignal {
  id: string;
  source: "traveler_feedback" | "agent_feedback" | "offer_review" | "quality_gate" | "source_check" | "usage_pattern";
  whatItCanImprove: string;
  allowedToChange: string[];
  forbiddenToChange: string[];
}

export interface SilaEvolutionRadarResult {
  mode: "EVOLUTION_RADAR_V1";
  candidates: SilaEvolutionCandidate[];
  learningSignals: SilaLearningSignal[];
  adoptionQueue: SilaEvolutionCandidate[];
  watchQueue: SilaEvolutionCandidate[];
  safetyPrinciples: string[];
}

const CANDIDATES: SilaEvolutionCandidate[] = [
  {
    id: "openai-agents-sdk-ts",
    name: "OpenAI Agents SDK TypeScript",
    category: "agent_runtime",
    sourceKind: "official_sdk",
    whyItHelpsSila: "يوفر agent loop وtool calling وhandoffs وtracing مناسبين لتشغيل وكلاء صلة لاحقًا بدل تنفيذ يدوي لكل خطوة.",
    risks: ["يحتاج مفاتيح مدفوعة غالبًا", "لا يجب استخدامه لتجاوز Human Approval"],
    decision: "PILOT",
    nextStep: "جرّبه في route معزول بعد دمج #88، بدون تغيير قرارات السفر أو العروض تلقائيًا.",
  },
  {
    id: "vercel-ai-sdk-gateway",
    name: "Vercel AI SDK + AI Gateway",
    category: "model_routing",
    sourceKind: "platform_feature",
    whyItHelpsSila: "يتماشى مع استضافة المشروع على Vercel، ويدعم provider-agnostic model routing وtool calls وstreaming.",
    risks: ["Free tier محدود", "يجب مراقبة التكلفة والـrate limits"],
    decision: "ADOPT_NOW",
    nextStep: "استخدمه كمسار التشغيل الافتراضي عندما يكون VERCEL_AI_GATEWAY_API_KEY متاحًا.",
  },
  {
    id: "mcp-tool-registry",
    name: "MCP Tool Registry Pattern",
    category: "tool_registry",
    sourceKind: "architecture_pattern",
    whyItHelpsSila: "يناسب ربط مصادر رسمية، أدوات عروض، أدوات وكلاء، وملفات داخلية كأدوات واضحة الصلاحيات.",
    risks: ["فتح أدوات كثيرة للنموذج قد يزيد مخاطر التنفيذ الخاطئ", "كل أداة تحتاج schema وapproval policy"],
    decision: "PILOT",
    nextStep: "حوّل أدوات صلة الحالية إلى registry typed قبل إضافة أدوات خارجية حقيقية.",
  },
  {
    id: "qdrant-or-chroma-rag-memory",
    name: "Qdrant / Chroma RAG Memory",
    category: "rag_memory",
    sourceKind: "open_source_repo",
    whyItHelpsSila: "يوفر ذاكرة طويلة المدى لملفات العملاء والوكلاء والعروض والمحادثات مع استرجاع موجه بالمصادر.",
    risks: ["لا يصلح لتخزين أسرار غير مشفرة", "RAG لا يعني حقيقة رسمية؛ لازم Trust Ledger"],
    decision: "WATCH",
    nextStep: "بعد استقرار Advisor API، صمم memory schema ثم اختر vector store حسب التكلفة والاستضافة.",
  },
  {
    id: "agent-observability-telemetry",
    name: "Agent Observability / Tracing",
    category: "observability",
    sourceKind: "platform_feature",
    whyItHelpsSila: "يساعدنا نعرف الوكيل اختار إيه، فشل ليه، وكمّل منين، بدون تخزين مفاتيح أو بيانات حساسة.",
    risks: ["قد يسجل بيانات عميل حساسة لو مفيش masking", "يلزم retention policy"],
    decision: "ADOPT_NOW",
    nextStep: "أضف trace IDs وredaction policy قبل تفعيل أي tool خارجي.",
  },
  {
    id: "self-modifying-agent-code",
    name: "Self-modifying Production Agent",
    category: "agent_runtime",
    sourceKind: "architecture_pattern",
    whyItHelpsSila: "قد يبدو قويًا لأنه يغير نفسه تلقائيًا، لكنه خطر على الثقة والسلامة.",
    risks: ["قد يكسر المنتج", "قد يتجاوز الموافقات", "قد يضيف اعتماديات غير آمنة"],
    decision: "REJECT_FOR_NOW",
    nextStep: "صلة تقترح تحسينات وتفتح مهام مراجعة فقط؛ لا تعدّل production وحدها.",
  },
];

const LEARNING_SIGNALS: SilaLearningSignal[] = [
  {
    id: "traveler-preferences",
    source: "traveler_feedback",
    whatItCanImprove: "ترتيب الأسئلة، نبرة الرد، الوجهات المفضلة، ودرجة تفصيل النص.",
    allowedToChange: ["أولويات الأسئلة", "ملخص ملف العميل", "اقتراحات next step"],
    forbiddenToChange: ["شروط فيزا", "توفر عرض", "سعر مؤكد"],
  },
  {
    id: "agent-quote-feedback",
    source: "agent_feedback",
    whatItCanImprove: "Brief الوكيل، الحقول الناقصة قبل التسعير، وطريقة عرض المخاطر التجارية.",
    allowedToChange: ["قالب brief", "قائمة النواقص", "تعلم أسلوب الوكيل"],
    forbiddenToChange: ["تأكيد سعر نيابة عن الوكيل", "إرسال وعد للعميل بلا موافقة"],
  },
  {
    id: "offer-review-outcomes",
    source: "offer_review",
    whatItCanImprove: "قواعد اكتشاف العروض المنتهية، الضعيفة المصدر، أو المحتاجة إعادة تأكيد.",
    allowedToChange: ["أوزان المخاطر", "أولوية المراجعة", "اقتراح تعليق للأدمن"],
    forbiddenToChange: ["نشر عرض", "إيقاف عرض منشور نهائيًا بدون موافقة بشرية"],
  },
  {
    id: "quality-gate-blocks",
    source: "quality_gate",
    whatItCanImprove: "تقليل الهلوسة، تحسين صياغة التحذيرات، وتحديد سبب المنع بوضوح.",
    allowedToChange: ["رسائل التحذير", "قواعد صياغة الرد", "قائمة blockedBy"],
    forbiddenToChange: ["تخفيف تحذير أمان مهم", "تمرير مصدر غير موثق"],
  },
];

const SAFETY_PRINCIPLES = [
  "صلة تتعلم من الإشارات، لكنها لا تحول الإشارة إلى حقيقة رسمية بلا مصدر.",
  "أي تحسين ذاتي يتحول إلى مهمة مراجعة أو اختبار، وليس تغيير production تلقائي.",
  "الذاكرة الشخصية تحسن التجربة، لكنها لا تستبدل المصادر الرسمية.",
  "كل إضافة جديدة يجب أن تمر عبر CI وQuality Guard وHuman Approval قبل الدمج.",
];

export function runSilaEvolutionRadar(): SilaEvolutionRadarResult {
  return {
    mode: "EVOLUTION_RADAR_V1",
    candidates: CANDIDATES,
    learningSignals: LEARNING_SIGNALS,
    adoptionQueue: CANDIDATES.filter((candidate) => candidate.decision === "ADOPT_NOW" || candidate.decision === "PILOT"),
    watchQueue: CANDIDATES.filter((candidate) => candidate.decision === "WATCH"),
    safetyPrinciples: SAFETY_PRINCIPLES,
  };
}

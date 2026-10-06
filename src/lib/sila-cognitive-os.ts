import { runSilaAgenticOs, type SilaAgenticOsResult } from "./sila-agentic-os";
import type { SilaMissionControlInput } from "./sila-mission-control";

export type SilaAutonomyLevel =
  | "L0_ASSIST_ONLY"
  | "L1_PLAN_AND_EXPLAIN"
  | "L2_MONITOR_AND_DRAFT"
  | "L3_LOW_RISK_EXECUTION"
  | "L4_HUMAN_APPROVED_HIGH_IMPACT";

export type SilaCognitiveSignalKind =
  | "TRUST_LEDGER"
  | "WORLD_WATCHER"
  | "MEMORY_RECALL"
  | "SELF_EVALUATION"
  | "HUMAN_REVIEW"
  | "LEARNING_SIGNAL";

export interface SilaTrustLedgerRule {
  id: string;
  rule: string;
  required: boolean;
}

export interface SilaWorldWatcher {
  id: string;
  watches: string;
  cadence: "on_demand" | "hourly" | "daily" | "before_recommendation";
  evidenceRequired: string[];
  allowedAction: "flag" | "draft" | "request_confirmation" | "suspend_candidate";
}

export interface SilaCognitiveLoop {
  id: string;
  signal: SilaCognitiveSignalKind;
  purpose: string;
  output: string;
}

export interface SilaCognitiveOsResult {
  mode: "COGNITIVE_TRAVEL_OS_V1";
  agenticOs: SilaAgenticOsResult;
  autonomyLevel: SilaAutonomyLevel;
  trustLedger: SilaTrustLedgerRule[];
  worldWatchers: SilaWorldWatcher[];
  cognitiveLoops: SilaCognitiveLoop[];
  releaseGate: {
    canAnswerTraveler: boolean;
    canRecommendOffer: boolean;
    canExecuteExternalAction: boolean;
    blockedBy: string[];
  };
}

const TRUST_LEDGER: SilaTrustLedgerRule[] = [
  {
    id: "source-required",
    rule: "كل ادعاء خارجي عن فيزا/ترانزيت/طيران/سعر/توفر يحتاج مصدرًا أو تأكيدًا موثقًا.",
    required: true,
  },
  {
    id: "freshness-required",
    rule: "كل مصدر يجب أن يحمل checkedAt أو lastConfirmedAt قبل تحويله إلى قرار.",
    required: true,
  },
  {
    id: "scope-required",
    rule: "كل حقيقة سفر يجب أن تكون مربوطة بالجنسية، الوجهة، التاريخ، شركة الطيران، أو الوكيل المناسب.",
    required: true,
  },
  {
    id: "confidence-required",
    rule: "صلة تعرض درجة الثقة: مؤكد، يحتاج تأكيد، قديم، متضارب، أو غير متاح.",
    required: true,
  },
];

const WORLD_WATCHERS: SilaWorldWatcher[] = [
  {
    id: "visa-rules-watcher",
    watches: "تغيرات شروط الدخول والتأشيرات حسب الجنسية والوجهة.",
    cadence: "before_recommendation",
    evidenceRequired: ["official source", "checkedAt", "scope"],
    allowedAction: "flag",
  },
  {
    id: "airline-transit-watcher",
    watches: "شروط الترانزيت والمطارات وشركات الطيران التي قد تغيّر قرار الرحلة.",
    cadence: "before_recommendation",
    evidenceRequired: ["airline/airport source", "checkedAt", "route scope"],
    allowedAction: "draft",
  },
  {
    id: "offer-freshness-watcher",
    watches: "العروض المنشورة: انتهاء، سعر، توافر، تأكيد الوكيل، مصدر السعر.",
    cadence: "daily",
    evidenceRequired: ["agent confirmation", "price/source evidence", "expiry"],
    allowedAction: "suspend_candidate",
  },
  {
    id: "agent-trust-watcher",
    watches: "حالة توثيق الوكيل وأدلة الثقة المرتبطة بالعروض.",
    cadence: "daily",
    evidenceRequired: ["current trust evidence", "reviewedAt"],
    allowedAction: "request_confirmation",
  },
];

function decideAutonomy(agenticOs: SilaAgenticOsResult): SilaAutonomyLevel {
  if (!agenticOs.kernel.missionControl.aiRuntime.canCallModel) return "L1_PLAN_AND_EXPLAIN";
  if (agenticOs.finalGate.requiresHumanApproval) return "L2_MONITOR_AND_DRAFT";
  if (agenticOs.finalGate.canAnswerTraveler && !agenticOs.finalGate.canExecuteExternalAction) return "L2_MONITOR_AND_DRAFT";
  if (agenticOs.finalGate.canExecuteExternalAction) return "L4_HUMAN_APPROVED_HIGH_IMPACT";
  return "L0_ASSIST_ONLY";
}

function buildCognitiveLoops(agenticOs: SilaAgenticOsResult): SilaCognitiveLoop[] {
  return [
    {
      id: "recall-before-reasoning",
      signal: "MEMORY_RECALL",
      purpose: "استدعاء ذاكرة العميل والرحلة والوكيل قبل التخطيط.",
      output: "سياق منظم لا يتحول إلى حقيقة رسمية بلا مصدر.",
    },
    {
      id: "trust-ledger-check",
      signal: "TRUST_LEDGER",
      purpose: "فحص كل معلومة خارجية ضد المصدر والحداثة والنطاق والثقة.",
      output: "قائمة ادعاءات موثقة/ناقصة/مرفوضة.",
    },
    {
      id: "world-watch-before-recommendation",
      signal: "WORLD_WATCHER",
      purpose: "منع توصية سفر أو عرض قبل فحص العالم والعروض عند الحاجة.",
      output: "تنبيه أو مسودة أو طلب تأكيد، لا قرار وهمي.",
    },
    {
      id: "self-evaluate-before-output",
      signal: "SELF_EVALUATION",
      purpose: "مراجعة الرد النهائي ضد الهلوسة، نقص المصادر، والعروض غير المؤكدة.",
      output: agenticOs.finalGate.blockedBy.length ? agenticOs.finalGate.blockedBy.join(" | ") : "جاهز كمسودة آمنة.",
    },
    {
      id: "learn-from-feedback",
      signal: "LEARNING_SIGNAL",
      purpose: "استخدام قبول/رفض المستخدم والوكيل لتحسين الأولويات دون اختراع حقائق جديدة.",
      output: "إشارات تفضيل وسلوك، وليست مصادر رسمية.",
    },
  ];
}

export function runSilaCognitiveOs(input: SilaMissionControlInput, now = new Date()): SilaCognitiveOsResult {
  const agenticOs = runSilaAgenticOs(input, now);
  const blockedBy = [...agenticOs.finalGate.blockedBy];
  if (agenticOs.kernel.toolPlan.some((tool) => tool.tool === "OFFICIAL_WORLD_RESEARCH" && tool.status === "BLOCKED")) {
    blockedBy.push("World-connected research is planned but blocked until AI/search runtime is configured.");
  }
  return {
    mode: "COGNITIVE_TRAVEL_OS_V1",
    agenticOs,
    autonomyLevel: decideAutonomy(agenticOs),
    trustLedger: TRUST_LEDGER,
    worldWatchers: WORLD_WATCHERS,
    cognitiveLoops: buildCognitiveLoops(agenticOs),
    releaseGate: {
      canAnswerTraveler: agenticOs.finalGate.canAnswerTraveler,
      canRecommendOffer: agenticOs.finalGate.canRecommendOffer,
      canExecuteExternalAction: false,
      blockedBy,
    },
  };
}

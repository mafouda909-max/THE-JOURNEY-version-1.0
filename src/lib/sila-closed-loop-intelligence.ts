import { runSilaAgenticOs, type SilaAgenticOsResult } from "./sila-agentic-os";
import type { SilaMissionControlInput, SilaMissionTask } from "./sila-mission-control";

export type SilaClosedLoopPhase = "OBSERVE" | "REASON" | "ACT" | "AUDIT" | "LEARN";

export interface SilaClosedLoopRecord {
  id: string;
  phase: SilaClosedLoopPhase;
  title: string;
  decision: "PROCEED" | "WAIT_FOR_EVIDENCE" | "REQUIRES_HUMAN" | "BLOCK";
  evidenceRequired: string[];
  auditNote: string;
}

export interface SilaClosedLoopCheckpoint {
  id: string;
  label: string;
  trigger: "new_message" | "offer_changed" | "source_stale" | "agent_confirmation_due" | "quality_blocked";
  owner: "sila" | "agent" | "admin" | "traveler";
}

export interface SilaClosedLoopIntelligenceResult {
  mode: "CLOSED_LOOP_INTELLIGENCE_V1";
  os: SilaAgenticOsResult;
  loop: SilaClosedLoopRecord[];
  checkpoints: SilaClosedLoopCheckpoint[];
  auditTrail: string[];
  learningPlan: string[];
  operatingPrinciple: string;
}

function taskEvidence(task: SilaMissionTask) {
  return task.blockedBy?.length ? task.blockedBy : [task.title];
}

function observe(os: SilaAgenticOsResult): SilaClosedLoopRecord[] {
  const tasks = os.kernel.missionControl.tasks;
  const records: SilaClosedLoopRecord[] = [
    {
      id: "observe-memory-and-context",
      phase: "OBSERVE",
      title: "راقب ذاكرة العميل والرحلة والوكيل قبل أي رد.",
      decision: os.kernel.missionControl.advisorBrain ? "PROCEED" : "WAIT_FOR_EVIDENCE",
      evidenceRequired: ["ملف حالة صلة الحالي", "آخر رسالة من المستخدم", "تمييز USER_STATED/INFERRED/UNKNOWN"],
      auditNote: "لا تبدأ صلة من الصفر إذا كان لديها ملف حالة صالح.",
    },
  ];

  if (tasks.some((task) => task.kind === "REQUEST_SOURCE")) {
    records.push({
      id: "observe-world-evidence-gaps",
      phase: "OBSERVE",
      title: "راقب فجوات المصادر الرسمية قبل أي قرار سفر.",
      decision: "WAIT_FOR_EVIDENCE",
      evidenceRequired: tasks.filter((task) => task.kind === "REQUEST_SOURCE").flatMap(taskEvidence),
      auditNote: "أي ادعاء عن فيزا/ترانزيت/شركة طيران يظل غير مؤكد حتى يعود evidence packet.",
    });
  }

  if (os.kernel.missionControl.offerReviews.length > 0) {
    records.push({
      id: "observe-offer-health",
      phase: "OBSERVE",
      title: "راقب صحة العروض والصلاحية والتأكيدات.",
      decision: os.kernel.missionControl.tasks.some((task) => task.kind === "SUSPEND_OFFER") ? "REQUIRES_HUMAN" : "PROCEED",
      evidenceRequired: os.kernel.missionControl.offerReviews.flatMap((review) => review.findings.map((finding) => finding.action)),
      auditNote: "العرض لا يصبح توصية إلا إذا كان قابلًا للعرض العام ومؤكدًا ومطابقًا.",
    });
  }

  return records;
}

function reason(os: SilaAgenticOsResult): SilaClosedLoopRecord[] {
  return [
    {
      id: "reason-with-agentic-os",
      phase: "REASON",
      title: "حلّل الحالة بفريق وكلاء صلة وليس برد واحد.",
      decision: os.workflow.some((step) => step.status === "BLOCKED") ? "WAIT_FOR_EVIDENCE" : "PROCEED",
      evidenceRequired: os.workflow.filter((step) => step.status === "BLOCKED").map((step) => step.title),
      auditNote: "المنطق يمر عبر Research Agent وOffer Auditor وQuality Guard عند الحاجة.",
    },
  ];
}

function act(os: SilaAgenticOsResult): SilaClosedLoopRecord[] {
  return os.kernel.missionControl.tasks.map((task) => ({
    id: `act-${task.id}`,
    phase: "ACT" as const,
    title: task.title,
    decision:
      task.owner === "admin" || task.owner === "agent"
        ? "REQUIRES_HUMAN"
        : task.blockedBy?.length
          ? "WAIT_FOR_EVIDENCE"
          : "PROCEED",
    evidenceRequired: taskEvidence(task),
    auditNote: `${task.kind} · owner=${task.owner} · priority=${task.priority}`,
  }));
}

function audit(os: SilaAgenticOsResult): SilaClosedLoopRecord[] {
  return [
    {
      id: "audit-final-gate",
      phase: "AUDIT",
      title: "سجّل قرار البوابة النهائية قبل الرد أو التوصية.",
      decision: os.finalGate.canPublishOrChangeOffer ? "PROCEED" : "REQUIRES_HUMAN",
      evidenceRequired: [os.finalGate.reason],
      auditNote: "صلة لا تغيّر أو تنشر عرضًا عالي الأثر من غير موافقة بشرية.",
    },
  ];
}

function learn(os: SilaAgenticOsResult): SilaClosedLoopRecord[] {
  const hasAdvisor = Boolean(os.kernel.missionControl.advisorBrain);
  return [
    {
      id: "learn-from-case-and-outcome",
      phase: "LEARN",
      title: "حوّل نتيجة التفاعل إلى تحسين ذاكرة وتجربة.",
      decision: hasAdvisor ? "PROCEED" : "WAIT_FOR_EVIDENCE",
      evidenceRequired: ["ما الذي أكده المستخدم؟", "ما الذي صححه؟", "هل تم تأكيد العرض أو رفضه؟"],
      auditNote: "التعلم هنا يعني تحديث profile/constraints/preferences وليس اختراع حقائق جديدة.",
    },
  ];
}

function buildCheckpoints(os: SilaAgenticOsResult): SilaClosedLoopCheckpoint[] {
  const checkpoints: SilaClosedLoopCheckpoint[] = [
    { id: "new-message", label: "رسالة جديدة من المستخدم تحدث ملف صلة.", trigger: "new_message", owner: "sila" },
  ];

  if (os.kernel.missionControl.offerReviews.length > 0) {
    checkpoints.push({ id: "offer-change", label: "أي تغيير في العرض يعيد تشغيل Offer Auditor.", trigger: "offer_changed", owner: "sila" });
  }

  if (os.kernel.missionControl.tasks.some((task) => task.kind === "REQUEST_SOURCE")) {
    checkpoints.push({ id: "source-stale", label: "أي مصدر قديم أو ناقص يعيد تشغيل Research Agent.", trigger: "source_stale", owner: "sila" });
  }

  if (os.kernel.missionControl.tasks.some((task) => task.kind === "RECONFIRM_OFFER" || task.kind === "SUSPEND_OFFER")) {
    checkpoints.push({ id: "agent-confirmation", label: "تأكيد الوكيل مطلوب قبل إظهار العرض كصالح.", trigger: "agent_confirmation_due", owner: "agent" });
  }

  checkpoints.push({ id: "quality-blocked", label: "أي حظر جودة يمنع الخروج للمستخدم حتى الإصلاح.", trigger: "quality_blocked", owner: "admin" });
  return checkpoints;
}

function buildAuditTrail(loop: SilaClosedLoopRecord[]) {
  return loop.map((record) => `${record.phase}:${record.id}:${record.decision}`);
}

function buildLearningPlan(os: SilaAgenticOsResult) {
  const plan = [
    "حدّث ملف العميل فقط من معلومات قالها المستخدم أو أكدها الوكيل.",
    "اربط كل توصية عرض بسبب مطابقة واضح: وجهة/تاريخ/ميزانية/قيود.",
    "حوّل كل رفض جودة إلى قاعدة منع قابلة للاختبار لاحقًا.",
  ];
  if (os.kernel.missionControl.offerReviews.length > 0) {
    plan.push("سجّل أسباب انتهاء أو إيقاف العروض لتحسين مراقبة العروض القادمة.");
  }
  if (os.kernel.missionControl.advisorBrain?.researchNeeds.length) {
    plan.push("احتفظ بأنماط المصادر المطلوبة حسب الوجهة والجنسية والغرض لتسريع الفحص القادم.");
  }
  return plan;
}

export function runSilaClosedLoopIntelligence(input: SilaMissionControlInput, now = new Date()): SilaClosedLoopIntelligenceResult {
  const os = runSilaAgenticOs(input, now);
  const loop = [...observe(os), ...reason(os), ...act(os), ...audit(os), ...learn(os)];
  return {
    mode: "CLOSED_LOOP_INTELLIGENCE_V1",
    os,
    loop,
    checkpoints: buildCheckpoints(os),
    auditTrail: buildAuditTrail(loop),
    learningPlan: buildLearningPlan(os),
    operatingPrinciple:
      "صلة تعمل كدورة ذكاء تشغيلية: تراقب، تفكر، تنفذ ضمن الصلاحيات، تدقق، ثم تتعلم من النتيجة بدون اختراع حقائق.",
  };
}

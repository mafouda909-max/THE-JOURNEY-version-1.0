import { runSilaAgentKernel, type SilaAgentKernelResult, type SilaAgentToolName } from "./sila-agent-kernel";
import type { SilaMissionControlInput, SilaMissionTask } from "./sila-mission-control";

export type SilaSubAgentRole =
  | "RESEARCH_AGENT"
  | "OFFER_AUDITOR"
  | "TRAVELER_ADVISOR"
  | "AGENT_COPILOT"
  | "QUALITY_GUARD";

export interface SilaSubAgentSpec {
  role: SilaSubAgentRole;
  name: string;
  mission: string;
  allowedTools: SilaAgentToolName[];
  cannotDo: string[];
}

export interface SilaAgenticOsStep {
  id: string;
  agent: SilaSubAgentRole;
  title: string;
  dependsOn: string[];
  status: "READY" | "BLOCKED" | "REQUIRES_HUMAN" | "PLANNED";
  outputContract: string;
}

export interface SilaAgenticOsResult {
  mode: "AGENTIC_OS_V1";
  kernel: SilaAgentKernelResult;
  agents: SilaSubAgentSpec[];
  workflow: SilaAgenticOsStep[];
  finalGate: {
    canAnswerUser: boolean;
    canRecommendOffer: boolean;
    canPublishOrChangeOffer: boolean;
    reason: string;
  };
}

const SUB_AGENTS: SilaSubAgentSpec[] = [
  {
    role: "RESEARCH_AGENT",
    name: "باحث المصادر",
    mission: "يجمع evidence packets من مصادر رسمية أو موثوقة فقط قبل أي ادعاء سفر خارجي.",
    allowedTools: ["OFFICIAL_WORLD_RESEARCH"],
    cannotDo: ["لا يقرر وحده صلاحية السفر", "لا يستعمل مصدر بلا تاريخ أو نطاق انطباق"],
  },
  {
    role: "OFFER_AUDITOR",
    name: "مراجع العروض",
    mission: "يفحص صلاحية العرض، السعر، تاريخ الانتهاء، توثيق الوكيل، وحداثة التأكيد.",
    allowedTools: ["OFFER_REVIEW", "OFFER_MONITORING", "AGENT_CONFIRMATION"],
    cannotDo: ["لا يخترع عرضًا", "لا يترك عرضًا منتهيًا ظاهرًا كصالح"],
  },
  {
    role: "TRAVELER_ADVISOR",
    name: "مستشار المسافر",
    mission: "يبني إجابة عملية للمسافر من الذاكرة والمصادر المتاحة فقط.",
    allowedTools: ["CUSTOMER_MEMORY_RECALL", "ADVISOR_RESPONSE"],
    cannotDo: ["لا يعطي قرار فيزا نهائي بدون مصدر", "لا يدفع المستخدم للحجز قبل اكتمال المخاطر الحرجة"],
  },
  {
    role: "AGENT_COPILOT",
    name: "مساعد الوكيل",
    mission: "يحوّل كلام العميل إلى brief منظم للوكيل ويطلب الناقص قبل التسعير.",
    allowedTools: ["CUSTOMER_MEMORY_RECALL", "AGENT_CONFIRMATION", "ADVISOR_RESPONSE"],
    cannotDo: ["لا يسعر من الذاكرة", "لا يرسل وعدًا للعميل قبل تأكيد الوكيل"],
  },
  {
    role: "QUALITY_GUARD",
    name: "حارس الجودة",
    mission: "يراجع الخطة والرد قبل الخروج للمستخدم ويمنع الهلوسة أو الإجراء عالي الأثر.",
    allowedTools: ["QUALITY_REVIEW"],
    cannotDo: ["لا يسمح بمصدر وهمي", "لا يسمح بعرض وهمي", "لا يسمح بإجراء عالي الأثر بلا موافقة"],
  },
];

function toolStatus(kernel: SilaAgentKernelResult, tool: SilaAgentToolName) {
  return kernel.toolPlan.find((plan) => plan.tool === tool)?.status ?? "PLANNED";
}

function hasTask(tasks: SilaMissionTask[], kind: SilaMissionTask["kind"]) {
  return tasks.some((task) => task.kind === kind);
}

function pushStep(
  workflow: SilaAgenticOsStep[],
  step: Omit<SilaAgenticOsStep, "dependsOn"> & { dependsOn?: string[] },
) {
  workflow.push({ ...step, dependsOn: step.dependsOn ?? [] });
}

function buildWorkflow(kernel: SilaAgentKernelResult): SilaAgenticOsStep[] {
  const workflow: SilaAgenticOsStep[] = [];
  const tasks = kernel.missionControl.tasks;

  pushStep(workflow, {
    id: "recall-memory",
    agent: "TRAVELER_ADVISOR",
    title: "استدعاء ذاكرة العميل/الرحلة قبل الإجابة",
    status: toolStatus(kernel, "CUSTOMER_MEMORY_RECALL"),
    outputContract: "ملف ذاكرة يفصل بين ما قاله المستخدم وما استنتجته صلة وما لا يزال مجهولًا.",
  });

  if (hasTask(tasks, "REQUEST_SOURCE")) {
    pushStep(workflow, {
      id: "collect-evidence",
      agent: "RESEARCH_AGENT",
      title: "جمع مصادر العالم الرسمية قبل تحويل النص إلى قرار",
      dependsOn: ["recall-memory"],
      status: toolStatus(kernel, "OFFICIAL_WORLD_RESEARCH"),
      outputContract: "Evidence packet لكل ادعاء: source, checkedAt, scope, confidence, freshness.",
    });
  }

  if (kernel.missionControl.offerReviews.length > 0 || tasks.some((task) => task.kind.includes("OFFER"))) {
    pushStep(workflow, {
      id: "audit-offers",
      agent: "OFFER_AUDITOR",
      title: "مراجعة العروض والصلاحية قبل أي توصية",
      dependsOn: ["recall-memory"],
      status: toolStatus(kernel, "OFFER_REVIEW"),
      outputContract: "قرار عرض قابل للتنفيذ: publishable/reconfirm/suspend/invalid مع السبب.",
    });

    pushStep(workflow, {
      id: "schedule-offer-monitoring",
      agent: "OFFER_AUDITOR",
      title: "تحويل مشاكل العروض إلى مراقبة وتشغيل دوري",
      dependsOn: ["audit-offers"],
      status: toolStatus(kernel, "OFFER_MONITORING"),
      outputContract: "Ops queue: عروض قربت تنتهي، عروض تحتاج تأكيد، عروض يجب إيقافها.",
    });
  }

  if (kernel.missionControl.advisorBrain?.agentBrief) {
    pushStep(workflow, {
      id: "prepare-agent-copilot-brief",
      agent: "AGENT_COPILOT",
      title: "إعداد brief للوكيل بدون افتراض أسعار أو شروط",
      dependsOn: ["recall-memory"],
      status: "READY",
      outputContract: "Brief: المعروف، الناقص، لا تفترض، مصادر مطلوبة، خطوة الوكيل التالية.",
    });
  }

  pushStep(workflow, {
    id: "draft-advisor-response",
    agent: "TRAVELER_ADVISOR",
    title: "صياغة رد المستشار من الخطة فقط",
    dependsOn: workflow.map((step) => step.id).filter((id) => id !== "schedule-offer-monitoring"),
    status: toolStatus(kernel, "ADVISOR_RESPONSE"),
    outputContract: "رد مختصر عملي يوضح الثقة والناقص ولا يخترع مصادر أو عروض.",
  });

  pushStep(workflow, {
    id: "quality-gate",
    agent: "QUALITY_GUARD",
    title: "مراجعة نهائية تمنع الهلوسة والإجراءات عالية الأثر",
    dependsOn: ["draft-advisor-response"],
    status: "READY",
    outputContract: "PASS/BLOCK مع سبب: مصادر، عروض، صلاحيات، موافقة بشرية.",
  });

  return workflow;
}

function buildFinalGate(kernel: SilaAgentKernelResult, workflow: SilaAgenticOsStep[]): SilaAgenticOsResult["finalGate"] {
  const blocked = workflow.filter((step) => step.status === "BLOCKED");
  const hasSuspendedOffer = kernel.missionControl.tasks.some((task) => task.kind === "SUSPEND_OFFER");
  const needsHumanOfferChange = kernel.missionControl.tasks.some((task) => task.owner === "admin" || task.owner === "agent");
  return {
    canAnswerUser: true,
    canRecommendOffer: !hasSuspendedOffer && kernel.missionControl.offerReviews.every((review) => review.shouldDisplayPublicly),
    canPublishOrChangeOffer: false,
    reason:
      blocked.length > 0
        ? `يمكن لصلة الرد بحدود، لكن ${blocked.length} خطوة محجوبة بسبب غياب runtime أو مصدر.`
        : needsHumanOfferChange
          ? "صلة تستطيع التحليل، لكن أي تغيير عرض أو تأكيد تجاري يحتاج موافقة بشرية."
          : "الخطة جاهزة للرد الآمن مع حارس جودة قبل الإخراج.",
  };
}

export function runSilaAgenticOs(input: SilaMissionControlInput, now = new Date()): SilaAgenticOsResult {
  const kernel = runSilaAgentKernel(input, now);
  const workflow = buildWorkflow(kernel);
  return {
    mode: "AGENTIC_OS_V1",
    kernel,
    agents: SUB_AGENTS,
    workflow,
    finalGate: buildFinalGate(kernel, workflow),
  };
}

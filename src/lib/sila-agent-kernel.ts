import { planSilaMissionControl, type SilaMissionControlInput, type SilaMissionControlResult, type SilaMissionTask } from "./sila-mission-control";

export type SilaAgentToolName =
  | "OFFICIAL_WORLD_RESEARCH"
  | "OFFER_REVIEW"
  | "OFFER_MONITORING"
  | "AGENT_CONFIRMATION"
  | "CUSTOMER_MEMORY_RECALL"
  | "ADVISOR_RESPONSE"
  | "QUALITY_REVIEW";

export type SilaAgentToolStatus = "READY" | "BLOCKED" | "REQUIRES_HUMAN" | "PLANNED";

export interface SilaAgentToolPlan {
  tool: SilaAgentToolName;
  status: SilaAgentToolStatus;
  purpose: string;
  blockedBy: string[];
  outputContract: string;
}

export interface SilaAgentKernelResult {
  mode: "AGENT_KERNEL_V1";
  missionControl: SilaMissionControlResult;
  toolPlan: SilaAgentToolPlan[];
  executionOrder: SilaAgentToolName[];
  worldConnectionPolicy: {
    principle: string;
    requiredForExternalClaims: readonly string[];
    forbidden: readonly string[];
  };
  autonomyBoundaries: string[];
}

const WORLD_CONNECTION_POLICY = {
  principle:
    "صلة مستشار متصل بالعالم: لا يحوّل أي معلومة خارجية إلى قرار إلا بمصدر، تاريخ تحديث، نطاق انطباق، ودرجة ثقة.",
  requiredForExternalClaims: [
    "مصدر رسمي أو مزود موثوق",
    "تاريخ آخر تحديث أو تأكيد",
    "نطاق الانطباق: الجنسية/الوجهة/التاريخ/شركة الطيران/الوكيل",
    "درجة ثقة واضحة: مؤكد، يحتاج تأكيد، قديم، غير متاح",
  ],
  forbidden: [
    "اختراع شروط فيزا أو ترانزيت",
    "اختراع عروض أو أسعار غير موجودة في المخزون",
    "تقديم معلومة ويب عامة كقرار سفر نهائي",
    "تنفيذ إجراء عالي المخاطر بدون موافقة بشرية",
  ],
} as const;

function tool(
  name: SilaAgentToolName,
  status: SilaAgentToolStatus,
  purpose: string,
  outputContract: string,
  blockedBy: string[] = [],
): SilaAgentToolPlan {
  return { tool: name, status, purpose, outputContract, blockedBy };
}

function shouldRequestWorldResearch(tasks: SilaMissionTask[]) {
  return tasks.some((task) => task.kind === "REQUEST_SOURCE");
}

function hasOfferWork(tasks: SilaMissionTask[]) {
  return tasks.some((task) => task.kind === "REVIEW_OFFER" || task.kind === "RECONFIRM_OFFER" || task.kind === "SUSPEND_OFFER");
}

function hasAgentBriefWork(tasks: SilaMissionTask[]) {
  return tasks.some((task) => task.kind === "PREPARE_AGENT_BRIEF" || task.kind === "QUALIFY_CLIENT");
}

function buildToolPlan(missionControl: SilaMissionControlResult): SilaAgentToolPlan[] {
  const tasks = missionControl.tasks;
  const aiBlockedBy = missionControl.aiRuntime.canCallModel ? [] : missionControl.aiRuntime.missing;
  const plans: SilaAgentToolPlan[] = [
    tool(
      "CUSTOMER_MEMORY_RECALL",
      missionControl.advisorBrain ? "READY" : "PLANNED",
      "استدعاء ملف العميل/المسافر/الوكيل والرحلة قبل الإجابة.",
      "ملف ذاكرة منظم يفرّق بين USER_STATED وINFERRED وUNKNOWN.",
    ),
    tool(
      "ADVISOR_RESPONSE",
      missionControl.advisorBrain ? "READY" : "PLANNED",
      "إنتاج إجابة تنفيذية محدودة بالذاكرة والمصادر المتاحة.",
      "إجابة مع next actions وحدود ثقة، لا ادعاءات خارجية غير موثقة.",
      aiBlockedBy,
    ),
    tool(
      "QUALITY_REVIEW",
      "READY",
      "مراجعة ذاتية قبل عرض النتيجة: هل اخترعنا مصدرًا أو عرضًا أو قرارًا؟",
      "قائمة منع: لا عروض وهمية، لا شروط سفر نهائية بلا مصدر، لا تنفيذ بدون موافقة.",
    ),
  ];

  if (shouldRequestWorldResearch(tasks)) {
    plans.push(
      tool(
        "OFFICIAL_WORLD_RESEARCH",
        missionControl.aiRuntime.canCallModel ? "READY" : "BLOCKED",
        "ربط صلة بالعالم: سفارات، شركات طيران، GDS/مزودات لاحقًا، ومصادر رسمية للسفر.",
        "Evidence packet: source URL/name, checkedAt, scope, confidence, freshness.",
        missionControl.aiRuntime.canCallModel ? [] : ["AI/search runtime غير مفعّل", ...aiBlockedBy],
      ),
    );
  }

  if (hasOfferWork(tasks) || missionControl.offerReviews.length > 0) {
    plans.push(
      tool(
        "OFFER_REVIEW",
        "READY",
        "مراجعة العرض قبل ظهوره للمستخدم أو قبل التوصية به.",
        "قرار PUBLISHABLE/NEEDS_CONFIRMATION/EXPIRED/INVALID/SUSPEND مع أسباب قابلة للتنفيذ.",
      ),
      tool(
        "OFFER_MONITORING",
        "PLANNED",
        "مراقبة العروض دوريًا لاكتشاف الانتهاء، ضعف المصادر، أو الحاجة لإعادة التأكيد.",
        "Ops queue للأدمن/الوكيل: suspend, reconfirm, request source, publishable.",
      ),
    );
  }

  if (hasAgentBriefWork(tasks)) {
    plans.push(
      tool(
        "AGENT_CONFIRMATION",
        "REQUIRES_HUMAN",
        "طلب تأكيد الوكيل على السعر والتوافر والشروط قبل عرضها للعميل.",
        "تأكيد بشري مؤرخ ومربوط بالعرض/الوجهة/التاريخ.",
      ),
    );
  }

  return plans;
}

function buildExecutionOrder(toolPlan: SilaAgentToolPlan[]): SilaAgentToolName[] {
  const order: SilaAgentToolName[] = [
    "CUSTOMER_MEMORY_RECALL",
    "OFFICIAL_WORLD_RESEARCH",
    "OFFER_REVIEW",
    "AGENT_CONFIRMATION",
    "ADVISOR_RESPONSE",
    "QUALITY_REVIEW",
    "OFFER_MONITORING",
  ];
  const available = new Set(toolPlan.map((plan) => plan.tool));
  return order.filter((toolName) => available.has(toolName));
}

export function runSilaAgentKernel(input: SilaMissionControlInput, now = new Date()): SilaAgentKernelResult {
  const missionControl = planSilaMissionControl(input, now);
  const toolPlan = buildToolPlan(missionControl);
  return {
    mode: "AGENT_KERNEL_V1",
    missionControl,
    toolPlan,
    executionOrder: buildExecutionOrder(toolPlan),
    worldConnectionPolicy: WORLD_CONNECTION_POLICY,
    autonomyBoundaries: [
      "صلة تخطط وتقترح وتراجع، لكنها لا تحجز ولا تدفع ولا تنشر عرضًا عالي الأثر بدون موافقة بشرية.",
      "كل tool خارجي يجب أن يرجع evidence packet أو يفشل مغلقًا.",
      "الذاكرة تفيد التجربة لكنها لا تتحول إلى حقيقة رسمية بلا مصدر.",
      "النموذج الحي لا يعمل ولا يُعرض كحقيقة منتج إلا بعد تفعيل AI Runtime فعلي.",
    ],
  };
}

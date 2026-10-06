import type { AdvisorFollowUpQuestion } from "@/lib/readiness-advisor-policy";
import type { AdvisorDecisionClaim } from "@/lib/readiness-decision-dossier";
import type { TravelReadinessInput } from "@/lib/travel-readiness";

export type TransitRouteComplexity = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
export type TransitRouteStatus = "NOT_APPLICABLE" | "NEEDS_INPUT" | "AVAILABLE";

export interface TransitRouteFactor {
  id: "connection" | "baggage" | "airside" | "layover";
  label: string;
  state: "LOWER_COMPLEXITY" | "COMPLEXITY" | "INFO" | "UNKNOWN";
  detail: string;
  nextAction: string;
}

export interface TransitRouteAssessment {
  status: TransitRouteStatus;
  complexity: TransitRouteComplexity;
  complexityLabel: string;
  summary: string;
  routeDescription: string | null;
  layoverMinutes: number | null;
  factors: TransitRouteFactor[];
  limitations: string[];
}


const TRANSIT_CONNECTION_VALUES = new Set([
  "same_terminal",
  "terminal_change",
  "airport_change",
  "unknown",
]);
const TRANSIT_BAGGAGE_VALUES = new Set(["through", "recheck", "unknown"]);
const TRANSIT_AIRSIDE_VALUES = new Set(["airside", "landside", "unknown"]);
const UNKNOWN_LAYOVER_VALUES = new Set([
  "غير متأكد",
  "غير متاكد",
  "غير معروف",
  "لا أعرف",
  "لا اعرف",
  "unknown",
  "not sure",
]);

function asciiDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const arabic = "٠١٢٣٤٥٦٧٨٩".indexOf(digit);
    if (arabic >= 0) return String(arabic);
    const persian = "۰۱۲۳۴۵۶۷۸۹".indexOf(digit);
    return persian >= 0 ? String(persian) : digit;
  });
}

function normalizedUnknown(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ar-EG");
}

function parseLayoverMinutes(value: string): number | null {
  const normalized = asciiDigits(value.trim());
  if (!/^\d{1,4}$/.test(normalized)) return null;
  const minutes = Number(normalized);
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440 ? minutes : null;
}

export function isValidStructuredTransitAnswer(key: string, value: string): boolean {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text || text.length > 500) return false;

  if (key === "transit_country") return text.length >= 2 && text.length <= 64;
  if (key === "decision_transit_route" || key === "transit_route") {
    return text.length >= 2;
  }
  if (key === "decision_transit_connection") return TRANSIT_CONNECTION_VALUES.has(text);
  if (key === "decision_transit_baggage") return TRANSIT_BAGGAGE_VALUES.has(text);
  if (key === "decision_transit_airside") return TRANSIT_AIRSIDE_VALUES.has(text);
  if (key === "decision_transit_layover_minutes") {
    return parseLayoverMinutes(text) !== null || UNKNOWN_LAYOVER_VALUES.has(normalizedUnknown(text));
  }
  return true;
}

export const TRANSIT_ROUTE_QUESTIONS: AdvisorFollowUpQuestion[] = [
  {
    id: "decision_transit_route",
    label: "اكتب خط السير: المطارات وشركات الطيران إن كنت تعرفها.",
    why: "اسم دولة الترانزيت وحده لا يكفي لفهم بنية الربط.",
    kind: "text",
    placeholder: "مثال: CAI → FCO → MAD على نفس شركة الطيران",
  },
  {
    id: "decision_transit_connection",
    label: "هل الربط في نفس المبنى، تغيير مبنى، أم تغيير مطار؟",
    why: "تغيير المطار أو المبنى يغيّر التعقيد التشغيلي وقد يستلزم إجراءات إضافية.",
    kind: "choice",
    options: [
      { value: "same_terminal", label: "نفس المبنى/الترمينال" },
      { value: "terminal_change", label: "تغيير مبنى/ترمينال داخل نفس المطار" },
      { value: "airport_change", label: "تغيير مطار" },
      { value: "unknown", label: "غير متأكد" },
    ],
  },
  {
    id: "decision_transit_baggage",
    label: "ماذا سيحدث للأمتعة المسجلة؟",
    why: "استلام الأمتعة وإعادة شحنها قد يضيف انتقالًا وإجراءات لا نفترضها من اسم الرحلة.",
    kind: "choice",
    options: [
      { value: "through", label: "مشحونة حتى الوجهة النهائية" },
      { value: "recheck", label: "سأستلمها وأعيد شحنها" },
      { value: "unknown", label: "غير متأكد" },
    ],
  },
  {
    id: "decision_transit_airside",
    label: "هل تتوقع البقاء داخل منطقة الترانزيت أم الخروج للجانب العام؟",
    why: "Airside وLandside مساران تشغيليان مختلفان، ولا نفترض أحدهما بدون معلومة.",
    kind: "choice",
    options: [
      { value: "airside", label: "Airside — داخل منطقة الترانزيت" },
      { value: "landside", label: "Landside — سأخرج للجانب العام" },
      { value: "unknown", label: "غير متأكد" },
    ],
  },
  {
    id: "decision_transit_layover_minutes",
    label: "كم مدة التوقف تقريبًا بالدقائق؟",
    why: "نسجل الوقت للسياق، لكن لا نقارنه بحد MCT رسمي إلا إذا توفر مصدر مطار/شركة موثوق.",
    kind: "text",
    placeholder: "مثال: 180 أو غير متأكد",
  },
];

function answer(input: TravelReadinessInput, id: string): string {
  return input.advisorAnswers?.[id]?.trim() ?? "";
}

function routeAnswer(input: TravelReadinessInput): string {
  return answer(input, "decision_transit_route") || answer(input, "transit_route");
}

export function missingTransitRouteQuestions(
  input: TravelReadinessInput,
): AdvisorFollowUpQuestion[] {
  if (!input.transitCountry) return [];
  return TRANSIT_ROUTE_QUESTIONS.filter((question) => {
    if (question.id === "decision_transit_route") {
      const route = routeAnswer(input);
      return !route || !isValidStructuredTransitAnswer(question.id, route);
    }
    const value = answer(input, question.id);
    return !value || !isValidStructuredTransitAnswer(question.id, value);
  });
}

function factorForConnection(value: string): TransitRouteFactor {
  if (value === "airport_change") {
    return {
      id: "connection",
      label: "الربط بين المطارات/المباني",
      state: "COMPLEXITY",
      detail: "أفدت أن الرحلة تتطلب تغيير مطار.",
      nextAction: "أكد وسيلة الانتقال والوقت المتاح ومتطلبات الدخول/العبور من المصادر المختصة قبل الحجز.",
    };
  }
  if (value === "terminal_change") {
    return {
      id: "connection",
      label: "الربط بين المطارات/المباني",
      state: "COMPLEXITY",
      detail: "أفدت أن الرحلة تتطلب تغيير مبنى داخل نفس المطار.",
      nextAction: "أكد هل الانتقال Airside أم Landside وراجع وقت الانتقال مع المطار أو شركة الطيران.",
    };
  }
  if (value === "same_terminal") {
    return {
      id: "connection",
      label: "الربط بين المطارات/المباني",
      state: "LOWER_COMPLEXITY",
      detail: "أفدت أن الربط داخل نفس المبنى/الترمينال.",
      nextAction: "أكد بوابات الوصول والمغادرة عند صدور جدول الرحلة النهائي.",
    };
  }
  return {
    id: "connection",
    label: "الربط بين المطارات/المباني",
    state: "UNKNOWN",
    detail: "مكان الربط الدقيق غير مؤكد.",
    nextAction: "أكد هل هناك تغيير مبنى أو مطار قبل الاعتماد على وقت التوقف.",
  };
}

function factorForBaggage(value: string): TransitRouteFactor {
  if (value === "recheck") {
    return {
      id: "baggage",
      label: "الأمتعة",
      state: "COMPLEXITY",
      detail: "أفدت أنك ستستلم الأمتعة ثم تعيد شحنها.",
      nextAction: "أكد إجراءات الاستلام وإعادة الشحن وهل تتطلب المرور بإجراءات دخول أو انتقال منفصل.",
    };
  }
  if (value === "through") {
    return {
      id: "baggage",
      label: "الأمتعة",
      state: "LOWER_COMPLEXITY",
      detail: "أفدت أن الأمتعة مشحونة حتى الوجهة النهائية.",
      nextAction: "أكد ذلك على التذكرة/بطاقة الأمتعة عند إصدار الحجز؛ صلة لا تعتبره ضمانًا من وصفك فقط.",
    };
  }
  return {
    id: "baggage",
    label: "الأمتعة",
    state: "UNKNOWN",
    detail: "مسار الأمتعة غير مؤكد.",
    nextAction: "اسأل شركة الطيران هل الأمتعة Through Checked أم تحتاج استلامًا وإعادة شحن.",
  };
}

function factorForAirside(value: string): TransitRouteFactor {
  if (value === "landside") {
    return {
      id: "airside",
      label: "Airside / Landside",
      state: "COMPLEXITY",
      detail: "أفدت أنك تتوقع الخروج للجانب العام Landside.",
      nextAction: "أكد متطلبات الدخول/العبور للبلد والمطار؛ الخروج Landside لا يُعامل كعبور Airside تلقائيًا.",
    };
  }
  if (value === "airside") {
    return {
      id: "airside",
      label: "Airside / Landside",
      state: "LOWER_COMPLEXITY",
      detail: "أفدت أنك تتوقع البقاء داخل منطقة الترانزيت Airside.",
      nextAction: "أكد أن خط السير الفعلي يسمح بالبقاء Airside وأن البوابات/الأمتعة لا تفرض الخروج.",
    };
  }
  return {
    id: "airside",
    label: "Airside / Landside",
    state: "UNKNOWN",
    detail: "غير معروف هل الربط يبقى Airside أم يتطلب الخروج Landside.",
    nextAction: "أكد المسار من المطار أو شركة الطيران قبل استنتاج متطلبات العبور.",
  };
}

function factorForLayover(minutes: number | null): TransitRouteFactor {
  return {
    id: "layover",
    label: "مدة التوقف",
    state: minutes === null ? "UNKNOWN" : "INFO",
    detail: minutes === null
      ? "مدة التوقف غير معروفة بصيغة قابلة للتحليل."
      : `أفدت أن مدة التوقف حوالي ${minutes} دقيقة.`,
    nextAction: "أكد الحد الأدنى الرسمي للربط MCT ومسافة/طريقة الانتقال من المطار أو شركة الطيران؛ لا تستخدم صلة حدًا عالميًا ثابتًا.",
  };
}

export function assessTransitRoute(input: TravelReadinessInput): TransitRouteAssessment {
  if (!input.transitCountry) {
    return {
      status: "NOT_APPLICABLE",
      complexity: "UNKNOWN",
      complexityLabel: "لا يوجد ترانزيت مدخل",
      summary: "لم تُدخل دولة ترانزيت، لذلك لا يوجد تحليل لمسار الربط.",
      routeDescription: null,
      layoverMinutes: null,
      factors: [],
      limitations: [],
    };
  }

  const routeDescription = routeAnswer(input) || null;
  const connection = answer(input, "decision_transit_connection");
  const baggage = answer(input, "decision_transit_baggage");
  const airside = answer(input, "decision_transit_airside");
  const layoverRaw = answer(input, "decision_transit_layover_minutes");
  const layoverMinutes = parseLayoverMinutes(layoverRaw);
  const missing = missingTransitRouteQuestions(input);

  const factors = [
    factorForConnection(connection),
    factorForBaggage(baggage),
    factorForAirside(airside),
    factorForLayover(layoverMinutes),
  ];

  const hasHigh =
    connection === "airport_change" ||
    baggage === "recheck" ||
    airside === "landside";
  const hasMedium = connection === "terminal_change";
  const lowerStructure =
    connection === "same_terminal" &&
    baggage === "through" &&
    airside === "airside";

  const complexity: TransitRouteComplexity = hasHigh
    ? "HIGH"
    : hasMedium
      ? "MEDIUM"
      : lowerStructure
        ? "LOW"
        : "UNKNOWN";

  const complexityLabel =
    complexity === "HIGH"
      ? "تعقيد تشغيلي مرتفع"
      : complexity === "MEDIUM"
        ? "تعقيد تشغيلي متوسط"
        : complexity === "LOW"
          ? "تعقيد تشغيلي أقل حسب وصفك"
          : "التعقيد غير محسوم";

  return {
    status: missing.length > 0 ? "NEEDS_INPUT" : "AVAILABLE",
    complexity,
    complexityLabel,
    summary:
      complexity === "HIGH"
        ? "المسار الذي وصفته يحتوي عناصر انتقال تحتاج تأكيدًا عمليًا وقانونيًا قبل الاعتماد على الربط."
        : complexity === "MEDIUM"
          ? "المسار يحتاج مراجعة انتقال داخل المطار قبل اعتبار وقت التوقف مريحًا."
          : complexity === "LOW"
            ? "وصفك يشير إلى مسار أبسط تشغيليًا، لكن صلة لم تتحقق من الحجز أو MCT أو قواعد العبور."
            : "لا توجد معلومات كافية لتقدير تعقيد مسار الربط.",
    routeDescription,
    layoverMinutes,
    factors,
    limitations: [
      "هذا تحليل لبنية المسار من إجابات المسافر، وليس تحققًا من التذكرة أو PNR أو شركة الطيران.",
      "لم تتم مقارنة مدة التوقف بحد Minimum Connection Time رسمي لأي مطار.",
      "LOW يعني تعقيدًا تشغيليًا أقل حسب الوصف فقط، وليس ضمان نجاح الربط أو السماح بالدخول/العبور.",
      "قواعد التأشيرة والعبور تظل مستقلة وتحتاج مصدرًا رسميًا مطابقًا للجنسية والمطار والمسار والتاريخ.",
    ],
  };
}

export function transitRouteDecisionClaims(
  input: TravelReadinessInput,
  assessment: TransitRouteAssessment,
): AdvisorDecisionClaim[] {
  if (!input.transitCountry || assessment.status === "NOT_APPLICABLE") return [];
  const observed = assessment.factors
    .filter((factor) => factor.state !== "UNKNOWN")
    .map((factor) => factor.detail);
  if (!assessment.routeDescription && observed.length === 0) return [];

  return [{
    id: "traveler:transit_route_structure",
    topic: "transit_route",
    topicLabel: "بنية مسار الترانزيت",
    statement: [
      assessment.routeDescription ? `خط السير المبلغ عنه: ${assessment.routeDescription}` : "",
      ...observed,
    ].filter(Boolean).join(" "),
    polarity: "NEUTRAL",
    sourceType: "TRAVELER_REPORTED",
    sourceLabel: "إجابات المسافر عن مسار الترانزيت",
    sourceUrl: null,
    authorityLevel: 2,
    evidenceStatus: "REPORTED",
    scope: [`مسار الترانزيت عبر ${input.transitCountry}`, "بنية تشغيلية فقط"],
    scopeKey: `transit_route::${input.transitCountry.trim().toLocaleLowerCase("en-US")}`,
    checkedAt: null,
    validUntil: null,
    limitations: [...assessment.limitations],
  }];
}

export function transitRouteResearchContext(
  input: TravelReadinessInput,
  assessment: TransitRouteAssessment,
): string[] {
  if (!input.transitCountry || assessment.status === "NOT_APPLICABLE") return [];
  return [
    assessment.routeDescription ? `خط السير الذي وصفه المستخدم: ${assessment.routeDescription}` : "",
    ...assessment.factors
      .filter((factor) => factor.state !== "UNKNOWN")
      .map((factor) => `${factor.label}: ${factor.detail}`),
  ].filter(Boolean);
}

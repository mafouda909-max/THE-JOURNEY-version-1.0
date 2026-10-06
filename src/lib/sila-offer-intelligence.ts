export type SilaOfferReviewDecision =
  | "PUBLISHABLE"
  | "NEEDS_CONFIRMATION"
  | "EXPIRED"
  | "INVALID"
  | "SUSPEND";

export type SilaOfferReviewSeverity = "info" | "warning" | "critical";

export interface SilaOfferReviewInput {
  id?: string | number | null;
  title: string;
  description: string;
  status: string;
  agentVerificationStatus?: string | null;
  agentTrustCurrent?: boolean | null;
  tripType: string;
  originCity?: string | null;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  departureDate?: Date | string | null;
  publishedAt?: Date | string | null;
  expiresAt?: Date | string | null;
  priceAmount: number;
  currency: string;
  priceType?: string | null;
  includes?: string[] | null;
  excludes?: string[] | null;
  sourceEvidence?: SilaOfferSourceEvidence[] | null;
  lastConfirmedAt?: Date | string | null;
}

export interface SilaOfferSourceEvidence {
  label: string;
  url?: string | null;
  checkedAt?: Date | string | null;
  kind: "agent_statement" | "official" | "inventory" | "price" | "availability" | "internal";
}

export interface SilaOfferReviewFinding {
  id: string;
  severity: SilaOfferReviewSeverity;
  message: string;
  action: string;
}

export interface SilaOfferReviewResult {
  decision: SilaOfferReviewDecision;
  confidence: number;
  statusLabel: string;
  findings: SilaOfferReviewFinding[];
  sourceSummary: string;
  shouldDisplayPublicly: boolean;
  reviewerNote: string;
}

const MIN_DESCRIPTION_LENGTH = 60;
const MIN_INCLUDES = 1;
const CONFIRMATION_MAX_AGE_HOURS = 24;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hoursSince(value: Date | string | null | undefined, now: Date) {
  const date = toDate(value);
  if (!date) return null;
  return Math.max(0, (now.getTime() - date.getTime()) / 3_600_000);
}

function hasEvidence(offer: SilaOfferReviewInput, kind: SilaOfferSourceEvidence["kind"]) {
  return (offer.sourceEvidence ?? []).some((source) => source.kind === kind);
}

function evidenceSummary(offer: SilaOfferReviewInput) {
  const evidence = offer.sourceEvidence ?? [];
  if (evidence.length === 0) return "لا توجد مصادر أو أدلة مرفقة بالعرض حتى الآن.";
  return evidence
    .map((source) => `${source.label}${source.checkedAt ? ` · تم الفحص ${toDate(source.checkedAt)?.toISOString().slice(0, 10)}` : ""}`)
    .join(" | ");
}

function pushFinding(
  findings: SilaOfferReviewFinding[],
  id: string,
  severity: SilaOfferReviewSeverity,
  message: string,
  action: string,
) {
  findings.push({ id, severity, message, action });
}

export function reviewSilaOfferIntelligence(
  offer: SilaOfferReviewInput,
  now = new Date(),
): SilaOfferReviewResult {
  const findings: SilaOfferReviewFinding[] = [];
  const expiresAt = toDate(offer.expiresAt);
  const departureDate = toDate(offer.departureDate);
  const confirmationAge = hoursSince(offer.lastConfirmedAt, now);

  if (offer.agentVerificationStatus && offer.agentVerificationStatus !== "verified") {
    pushFinding(
      findings,
      "agent-not-verified",
      "critical",
      "الوكيل غير موثق، لذلك لا يجب عرض العرض للعامة.",
      "أوقف النشر لحين اكتمال توثيق الوكيل.",
    );
  }

  if (offer.agentTrustCurrent === false) {
    pushFinding(
      findings,
      "agent-trust-expired",
      "critical",
      "أدلة ثقة الوكيل غير سارية أو تحتاج مراجعة.",
      "أوقف العرض واطلب تحديث أدلة الهوية/النشاط/الكيان.",
    );
  }

  if (expiresAt && expiresAt.getTime() <= now.getTime()) {
    pushFinding(
      findings,
      "offer-expired",
      "critical",
      "انتهت صلاحية العرض.",
      "حوّل العرض إلى expired ولا تعرضه للمسافرين.",
    );
  }

  if (departureDate && departureDate.getTime() <= now.getTime()) {
    pushFinding(
      findings,
      "departure-passed",
      "critical",
      "تاريخ السفر المرتبط بالعرض مضى بالفعل.",
      "أرشف العرض أو اطلب من الوكيل تاريخًا جديدًا.",
    );
  }

  if (!offer.title || offer.title.trim().length < 10) {
    pushFinding(findings, "weak-title", "warning", "عنوان العرض غير وصفي بما يكفي.", "اطلب عنوانًا يوضح الوجهة ونوع الرحلة.");
  }

  if (!offer.description || offer.description.trim().length < MIN_DESCRIPTION_LENGTH) {
    pushFinding(findings, "weak-description", "warning", "وصف العرض قصير ولا يكفي لاتخاذ قرار.", "اطلب وصفًا أوضح للمشمولات والشروط والاستثناءات.");
  }

  if (!offer.originCity || !offer.destinationCity || !offer.destinationCountry) {
    pushFinding(findings, "missing-route", "critical", "بيانات خط الرحلة غير مكتملة.", "لا تعتمد العرض حتى يكتمل الانطلاق والوجهة والدولة.");
  }

  if (!Number.isFinite(offer.priceAmount) || offer.priceAmount <= 0) {
    pushFinding(findings, "invalid-price", "critical", "السعر غير صالح أو غير محدد.", "اطلب سعرًا واضحًا قبل أي نشر أو توصية.");
  }

  if (!offer.currency || offer.currency.length !== 3) {
    pushFinding(findings, "invalid-currency", "warning", "عملة العرض غير واضحة.", "حدد العملة بوضوح للمستخدم.");
  }

  if ((offer.includes ?? []).filter(Boolean).length < MIN_INCLUDES) {
    pushFinding(findings, "missing-includes", "warning", "العرض لا يوضح أي مشمولات.", "اطلب من الوكيل إضافة مشمولات واضحة.");
  }

  if (!hasEvidence(offer, "agent_statement")) {
    pushFinding(findings, "missing-agent-confirmation", "warning", "لا يوجد تأكيد حديث من الوكيل على توفر العرض.", "اطلب تأكيد الوكيل قبل إبراز العرض.");
  }

  if (!hasEvidence(offer, "price")) {
    pushFinding(findings, "missing-price-source", "warning", "مصدر السعر غير مرفق.", "اربط السعر بتأكيد وكيل أو مصدر مخزون داخلي.");
  }

  if (confirmationAge === null) {
    pushFinding(findings, "not-confirmed", "warning", "لم يتم تسجيل وقت آخر تأكيد للعرض.", "سجّل وقت التأكيد قبل اعتبار العرض صالحًا للتوصية.");
  } else if (confirmationAge > CONFIRMATION_MAX_AGE_HOURS) {
    pushFinding(findings, "stale-confirmation", "warning", "تأكيد العرض قديم وقد لا يعكس التوفر الحالي.", "أعد تأكيد السعر والتوفر مع الوكيل.");
  }

  const critical = findings.filter((finding) => finding.severity === "critical");
  const warnings = findings.filter((finding) => finding.severity === "warning");
  let decision: SilaOfferReviewDecision;

  if (findings.some((finding) => finding.id === "offer-expired" || finding.id === "departure-passed")) {
    decision = "EXPIRED";
  } else if (critical.length > 0) {
    decision = offer.status === "published" ? "SUSPEND" : "INVALID";
  } else if (warnings.length > 0) {
    decision = "NEEDS_CONFIRMATION";
  } else {
    decision = "PUBLISHABLE";
  }

  const confidence = decision === "PUBLISHABLE" ? 0.86 : critical.length > 0 ? 0.92 : 0.68;
  const statusLabel = {
    PUBLISHABLE: "قابل للنشر/التوصية ضمن ما تم فحصه",
    NEEDS_CONFIRMATION: "محتاج تأكيد قبل الإبراز",
    EXPIRED: "منتهي أو تاريخ السفر مضى",
    INVALID: "غير صالح للاعتماد",
    SUSPEND: "يجب إيقافه مؤقتًا",
  }[decision];

  return {
    decision,
    confidence,
    statusLabel,
    findings,
    sourceSummary: evidenceSummary(offer),
    shouldDisplayPublicly: decision === "PUBLISHABLE" && offer.status === "published",
    reviewerNote:
      decision === "PUBLISHABLE"
        ? "صلة تستطيع عرض هذا العرض فقط مع استمرار مراقبة تاريخ الصلاحية والتأكيدات."
        : "صلة لا يجب أن تدفع هذا العرض للمستخدم قبل معالجة الملاحظات أعلاه.",
  };
}

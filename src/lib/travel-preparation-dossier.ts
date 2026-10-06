import type { Evidence } from "@/lib/evidence";
import type {
  DynamicChecklistItem,
  TravelPurpose,
  TravelReadinessInput,
  TravelReadinessResult,
} from "@/lib/travel-readiness";

export type TravelDossierCategory =
  | "IDENTITY"
  | "ENTRY"
  | "PURPOSE"
  | "ACCOMMODATION"
  | "FINANCE"
  | "HEALTH"
  | "TRANSPORT"
  | "LEGAL"
  | "OTHER";

export type TravelDossierRequirementState =
  | "CONFIRMED_REQUIRED"
  | "CONFIRMED_NOT_REQUIRED"
  | "TO_VERIFY"
  | "PLANNING_ONLY";

export type TravelDossierReadinessState =
  | "REPORTED_READY"
  | "NEEDS_ACTION"
  | "NEEDS_TRAVELER_CONFIRMATION"
  | "UNKNOWN"
  | "NOT_APPLICABLE";

export interface TravelDossierEvidenceSummary {
  sourceType: string;
  sourceLabel: string;
  sourceUrl: string | null;
  evidenceStatus: Evidence["status"];
  checkedAt: string | null;
  validUntil: string | null;
  scope: string[];
  limitations: string[];
}

export interface TravelDossierItem {
  id: string;
  category: TravelDossierCategory;
  title: string;
  requirementState: TravelDossierRequirementState;
  readinessState: TravelDossierReadinessState;
  why: string;
  nextAction: string;
  travelerReport: string | null;
  evidence: TravelDossierEvidenceSummary | null;
  limitations: string[];
}

export interface TravelPreparationDossier {
  purpose: TravelPurpose | null;
  items: TravelDossierItem[];
  confirmedRequired: string[];
  travelerAction: string[];
  needsOfficialConfirmation: string[];
  planning: string[];
  generatedAt: string;
  limitations: string[];
}

type Template = {
  id: string;
  category: TravelDossierCategory;
  title: string;
  why: string;
  nextAction: string;
  requirementState?: TravelDossierRequirementState;
  answerKey?: string;
  readyValues?: string[];
  actionValues?: string[];
};

const COMMON: Template[] = [
  {
    id: "passport",
    category: "IDENTITY",
    title: "جواز السفر وصلاحيته للرحلة",
    why: "وجود جواز حسب إدخالك لا يثبت أن مدة صلاحيته تطابق قاعدة الوجهة أو شركة الطيران.",
    nextAction: "طابق تاريخ انتهاء الجواز مع المصدر الرسمي المطبق على جنسيتك ووجهتك وتاريخ السفر.",
    requirementState: "TO_VERIFY",
  },
  {
    id: "entry_visa",
    category: "ENTRY",
    title: "التأشيرة أو إذن الدخول",
    why: "شرط التأشيرة يختلف حسب الجنسية والجواز والغرض والتاريخ.",
    nextAction: "استخدم الحكم الموثق إن وُجد، وإلا أكد الشرط من الجهة الرسمية قبل الدفع أو الحجز غير القابل للاسترداد.",
    requirementState: "TO_VERIFY",
  },
];

const PURPOSE_TEMPLATES: Record<TravelPurpose, Template[]> = {
  tourism: [
    {
      id: "tourism_accommodation",
      category: "ACCOMMODATION",
      title: "الإقامة وإثبات مكان السكن",
      why: "الإقامة مهمة عمليًا وقد تكون مستند دعم في بعض المسارات، لكن صلة لا تفترض أنها شرط رسمي دون دليل.",
      nextAction: "حدد مكان الإقامة، ثم أكد من المصدر الرسمي هل يلزم إثبات حجز أو عنوان.",
      requirementState: "TO_VERIFY",
      answerKey: "tourism_accommodation",
      readyValues: ["booked", "محجوزة", "محجوز", "نعم"],
      actionValues: ["flexible", "لسه مرنة", "مرنة"],
    },
    {
      id: "tourism_onward",
      category: "TRANSPORT",
      title: "العودة أو السفر اللاحق",
      why: "قد يُطلب إثبات مغادرة لاحقة في بعض المسارات، ولا نعتبره شرطًا عامًا من دون مصدر.",
      nextAction: "أكد هل تحتاج تذكرة عودة/مغادرة مثبتة قبل السفر أو عند الدخول.",
      requirementState: "TO_VERIFY",
      answerKey: "tourism_onward",
      readyValues: ["yes", "نعم"],
      actionValues: ["no", "لا"],
    },
    {
      id: "tourism_insurance",
      category: "HEALTH",
      title: "التأمين الطبي/السفر",
      why: "التأمين قد يكون شرطًا أو مجرد حماية عملية حسب الوجهة ونوع التأشيرة.",
      nextAction: "أكد متطلبات التغطية والحدود والتواريخ من الجهة المختصة قبل الشراء.",
      requirementState: "TO_VERIFY",
    },
    {
      id: "tourism_funds",
      category: "FINANCE",
      title: "إثبات القدرة المالية ووسيلة الدفع",
      why: "قد تظهر متطلبات مالية في بعض ملفات التأشيرة أو الدخول، لكن قيمتها وشكلها لا تُفترض عالميًا.",
      nextAction: "أكد هل توجد متطلبات مالية رسمية، وجهّز وسيلة دفع وخطة مصروفات الرحلة.",
      requirementState: "TO_VERIFY",
    },
    {
      id: "tourism_arrival",
      category: "TRANSPORT",
      title: "الوصول من المطار والتنقل الأول",
      why: "تجهيز عملي يقلل أخطاء الوصول، وليس شرط دخول قانونيًا بحد ذاته.",
      nextAction: "حدد مطار الوصول ووسيلة الانتقال لأول إقامة قبل السفر.",
      requirementState: "PLANNING_ONLY",
    },
  ],
  study: [
    {
      id: "study_admission",
      category: "PURPOSE",
      title: "خطاب/إثبات القبول الدراسي",
      why: "صلة تستخدمه كسياق دراسة ولا تعتبره شرطًا رسميًا إلا إذا دعمه مصدر مطابق.",
      nextAction: "احتفظ بإثبات القبول النهائي وتحقق من الشكل المقبول رسميًا لمسار الدراسة.",
      requirementState: "TO_VERIFY",
      answerKey: "study_admission",
      readyValues: ["yes", "نعم"],
      actionValues: ["no", "لا"],
    },
    {
      id: "study_finance",
      category: "FINANCE",
      title: "إثبات التمويل أو المصروفات",
      why: "طرق إثبات التمويل تختلف حسب الدولة والبرنامج ومدة الدراسة.",
      nextAction: "أكد القيمة والشكل المقبولين من الجهة الرسمية أو التعليمية المختصة.",
      requirementState: "TO_VERIFY",
    },
    {
      id: "study_insurance",
      category: "HEALTH",
      title: "التأمين الصحي للطالب",
      why: "قد يرتبط بالتأشيرة أو التسجيل أو الإقامة حسب النظام المحلي.",
      nextAction: "أكد نوع التغطية والفترة المطلوبة قبل شراء وثيقة.",
      requirementState: "TO_VERIFY",
    },
    {
      id: "study_housing",
      category: "ACCOMMODATION",
      title: "السكن وعنوان الوصول",
      why: "السكن جزء عملي من الانتقال وقد يدخل في مستندات بعض المسارات.",
      nextAction: "حدد خطة سكن أولية وتحقق هل يلزم إثباتها رسميًا.",
      requirementState: "TO_VERIFY",
    },
    {
      id: "study_arrival_registration",
      category: "LEGAL",
      title: "إجراءات ما بعد الوصول والتسجيل",
      why: "بعض برامج الدراسة تتطلب خطوات بعد الوصول لا يمكن تعميمها بين الدول.",
      nextAction: "راجع جهة التعليم والهجرة لمعرفة التسجيل أو الإقامة بعد الوصول.",
      requirementState: "TO_VERIFY",
    },
  ],
  work: [
    {
      id: "work_contract",
      category: "PURPOSE",
      title: "عقد العمل أو العرض الوظيفي",
      why: "وجود عقد مقابل مجرد البحث عن عمل يغيّر مسار السفر القانوني.",
      nextAction: "أكد العقد والجهة الموظفة والمسار القانوني للعمل قبل السفر.",
      requirementState: "TO_VERIFY",
      answerKey: "work_contract",
      readyValues: ["yes", "نعم"],
      actionValues: ["no", "لا"],
    },
    {
      id: "work_sponsor",
      category: "LEGAL",
      title: "صاحب العمل/الكفيل أو الجهة الراعية",
      why: "بعض الأنظمة تربط تصريح العمل بجهة راعية، لكن صلة لا تفترض وجود هذا النظام لكل دولة.",
      nextAction: "أكد مسؤولية صاحب العمل عن التأشيرة/التصريح والمستندات.",
      requirementState: "TO_VERIFY",
      answerKey: "work_sponsor",
      readyValues: ["yes", "نعم"],
      actionValues: ["no", "لا"],
    },
    {
      id: "work_medical",
      category: "HEALTH",
      title: "الفحص الطبي إن كان مطلوبًا",
      why: "الفحص الطبي ومتطلباته تختلف حسب الدولة والوظيفة.",
      nextAction: "أكد هل يلزم فحص طبي وأين يجب إجراؤه واعتماده.",
      requirementState: "TO_VERIFY",
    },
    {
      id: "work_police_legalization",
      category: "LEGAL",
      title: "صحيفة الحالة الجنائية والتصديقات إن لزم",
      why: "لا تُطلب بنفس الشكل في كل مسار عمل.",
      nextAction: "أكد المستندات المطلوب تصديقها وترجمتها والجهات المقبولة.",
      requirementState: "TO_VERIFY",
    },
    {
      id: "work_first_stay",
      category: "ACCOMMODATION",
      title: "السكن الأول بعد الوصول",
      why: "تجهيز تشغيلي مهم للانتقال حتى لو لم يكن شرطًا رسميًا.",
      nextAction: "حدد أول إقامة وطريقة الوصول إليها.",
      requirementState: "PLANNING_ONLY",
    },
  ],
  business: [
    {
      id: "business_invitation",
      category: "PURPOSE",
      title: "دعوة الشركة/المعرض/المؤتمر",
      why: "الدعوة قد تكون مستند دعم حسب مسار زيارة الأعمال.",
      nextAction: "احتفظ بالدعوة إن وجدت، ثم أكد هل الجهة الرسمية تشترط صيغة أو بيانات محددة.",
      requirementState: "TO_VERIFY",
      answerKey: "business_invitation",
      readyValues: ["yes", "نعم"],
      actionValues: ["no", "لا"],
    },
    {
      id: "business_scope",
      category: "LEGAL",
      title: "حدود النشاط المسموح أثناء الزيارة",
      why: "اجتماعات الأعمال لا تعني تلقائيًا السماح بتنفيذ عمل فعلي.",
      nextAction: "أكد أن النشاط المخطط مسموح تحت نوع الإذن/التأشيرة المناسبة.",
      requirementState: "TO_VERIFY",
      answerKey: "business_activity",
    },
    {
      id: "business_return",
      category: "TRANSPORT",
      title: "خطة العودة أو المغادرة التالية",
      why: "جزء عملي وقد يظهر ضمن مستندات الدخول في بعض المسارات.",
      nextAction: "أكد ما يجب إثباته قبل السفر.",
      requirementState: "TO_VERIFY",
    },
    {
      id: "business_stay",
      category: "ACCOMMODATION",
      title: "الإقامة وعنوان النشاط",
      why: "مهم لتنظيم الرحلة وقد يكون مستند دعم حسب الحالة.",
      nextAction: "حدد الإقامة وعنوان الاجتماعات/المؤتمر.",
      requirementState: "PLANNING_ONLY",
    },
  ],
  freelance: [
    {
      id: "freelance_permission",
      category: "LEGAL",
      title: "حق العمل عن بُعد تحت وضع الإقامة",
      why: "السياحة لا تعني تلقائيًا السماح بالعمل عن بُعد.",
      nextAction: "أكد من مصدر رسمي/مختص هل نشاطك مسموح ونوع الإقامة المناسب.",
      requirementState: "TO_VERIFY",
      answerKey: "freelance_remote",
    },
    {
      id: "freelance_income",
      category: "FINANCE",
      title: "إثبات مصدر الدخل/العملاء إن طُلب",
      why: "بعض المسارات الرقمية أو الإقامات قد تطلب إثبات دخل، لكن لا يوجد رقم عالمي.",
      nextAction: "أكد إن كان مطلوبًا وما الشكل/القيمة المقبولة.",
      requirementState: "TO_VERIFY",
      answerKey: "freelance_income",
    },
    {
      id: "freelance_tax",
      category: "LEGAL",
      title: "الآثار الضريبية والإقامة القانونية",
      why: "تحتاج مختصًا عند الإقامة الطويلة أو نشاط محلي؛ لا يقدم المستشار حكمًا ضريبيًا.",
      nextAction: "استشر مختصًا عند احتمال نشوء إقامة ضريبية أو نشاط محلي.",
      requirementState: "PLANNING_ONLY",
    },
    {
      id: "freelance_connectivity",
      category: "OTHER",
      title: "الإنترنت ومساحة العمل",
      why: "تجهيز تشغيلي مهم للعمل عن بُعد.",
      nextAction: "تحقق من الاتصال، النسخ الاحتياطي، وساعات العمل مع فرق التوقيت.",
      requirementState: "PLANNING_ONLY",
    },
  ],
  umrah: [
    {
      id: "umrah_entry",
      category: "ENTRY",
      title: "مسار الدخول المناسب للعمرة",
      why: "نوع التأشيرة/الإذن والقواعد الحالية تتغير ويجب ربطها بالجنسية والتاريخ.",
      nextAction: "أكد مسار الدخول من المصدر السعودي الرسمي قبل الإصدار.",
      requirementState: "TO_VERIFY",
    },
    {
      id: "umrah_health",
      category: "HEALTH",
      title: "متطلبات الصحة والتطعيم",
      why: "المتطلبات الصحية موسمية وقد تتغير.",
      nextAction: "راجع المتطلبات الصحية الرسمية المطبقة على جنسيتك وتاريخ السفر.",
      requirementState: "TO_VERIFY",
    },
    {
      id: "umrah_permits",
      category: "LEGAL",
      title: "التصاريح/الحجوزات الرقمية المرتبطة بالنسك إن انطبقت",
      why: "لا تفترض صلة أن تصريحًا بعينه مطلوب دائمًا؛ يجب الرجوع للنظام الرسمي الحالي.",
      nextAction: "راجع القنوات السعودية الرسمية للتصاريح أو الحجوزات المطبقة وقت رحلتك.",
      requirementState: "TO_VERIFY",
    },
    {
      id: "umrah_route",
      category: "TRANSPORT",
      title: "مكة/المدينة ومطار الوصول",
      why: "خط السير يؤثر على النقل والميقات والتجهيزات العملية.",
      nextAction: "ثبت ترتيب المدن ومطار الوصول والنقل بينهما.",
      requirementState: "PLANNING_ONLY",
      answerKey: "umrah_route",
    },
    {
      id: "umrah_miqat",
      category: "OTHER",
      title: "الإحرام والميقات حسب خط السير",
      why: "تفصيل ديني وتشغيلي يتغير حسب المسار الفعلي.",
      nextAction: "راجع الميقات المناسب لمسارك مع جهة موثوقة قبل الرحلة.",
      requirementState: "PLANNING_ONLY",
    },
  ],
  visit: [
    {
      id: "visit_host",
      category: "ACCOMMODATION",
      title: "بيانات المستضيف أو مكان الإقامة",
      why: "قد تُستخدم كإثبات عنوان أو سياق للزيارة حسب المسار.",
      nextAction: "جهز بيانات المستضيف/الإقامة وتأكد ما الذي تطلبه الجهة الرسمية.",
      requirementState: "TO_VERIFY",
      answerKey: "visit_host",
      readyValues: ["person", "hotel"],
    },
    {
      id: "visit_invitation",
      category: "PURPOSE",
      title: "الدعوة أو إثبات العلاقة إن طُلب",
      why: "شكل الدعوة وإثبات العلاقة يختلف حسب نوع الزيارة والدولة.",
      nextAction: "أكد هل الدعوة مطلوبة وما الصيغة المقبولة.",
      requirementState: "TO_VERIFY",
      answerKey: "visit_invitation",
      readyValues: ["yes", "نعم"],
      actionValues: ["no", "لا"],
    },
    {
      id: "visit_return",
      category: "TRANSPORT",
      title: "خطة المغادرة بعد الزيارة",
      why: "قد تكون جزءًا من ملف الزيارة أو مجرد تجهيز عملي.",
      nextAction: "أكد إن كان يلزم إثبات عودة/مغادرة.",
      requirementState: "TO_VERIFY",
    },
    {
      id: "visit_insurance",
      category: "HEALTH",
      title: "التأمين الصحي/السفر",
      why: "قد يكون شرطًا أو اختيارًا حسب المسار.",
      nextAction: "أكد التغطية المطلوبة رسميًا إن وجدت.",
      requirementState: "TO_VERIFY",
    },
  ],
  medical: [
    {
      id: "medical_appointment",
      category: "PURPOSE",
      title: "موعد/خطاب الجهة العلاجية",
      why: "يثبت سياق العلاج حسب ما يبلغه المستخدم، لكن متطلبات التأشيرة تحتاج مصدرًا رسميًا.",
      nextAction: "احتفظ بخطاب/موعد العلاج وتأكد من البيانات المطلوبة رسميًا.",
      requirementState: "TO_VERIFY",
      answerKey: "medical_appointment",
      readyValues: ["yes", "نعم"],
      actionValues: ["no", "لا"],
    },
    {
      id: "medical_reports",
      category: "HEALTH",
      title: "التقارير الطبية والترجمة",
      why: "الجهة العلاجية أو الحدود قد تحتاج مستندات بصيغ مختلفة.",
      nextAction: "اسأل الجهة العلاجية عن التقارير والترجمة المطلوبة قبل السفر.",
      requirementState: "TO_VERIFY",
    },
    {
      id: "medical_medicine",
      category: "HEALTH",
      title: "الأدوية والتصاريح إن لزم",
      why: "قيود حمل الأدوية تختلف حسب الدولة والمادة والكمية.",
      nextAction: "أكد قواعد إدخال الأدوية من الجهة الرسمية المختصة.",
      requirementState: "TO_VERIFY",
    },
    {
      id: "medical_companion",
      category: "PURPOSE",
      title: "المرافق ومستنداته",
      why: "المرافق قد يحتاج مسار دخول أو مستندات مستقلة.",
      nextAction: "إن كنت تحتاج مرافقًا، افحص حالته ومستنداته كمسافر مستقل.",
      requirementState: "TO_VERIFY",
      answerKey: "medical_companion",
      readyValues: ["yes", "نعم"],
    },
    {
      id: "medical_payment",
      category: "FINANCE",
      title: "الدفع/التأمين للجهة العلاجية",
      why: "ترتيب مالي مهم وقد تطلب الجهة العلاجية ضمانًا أو موافقة تأمين.",
      nextAction: "أكد طريقة الدفع أو الموافقة المالية مع الجهة العلاجية.",
      requirementState: "PLANNING_ONLY",
    },
  ],
  transit: [
    {
      id: "transit_permission",
      category: "ENTRY",
      title: "تأشيرة/إذن الترانزيت",
      why: "الحكم يعتمد على الجنسية والمطار وAirside/Landside والأمتعة وخط السير.",
      nextAction: "أكد شرط العبور من مصدر رسمي مطابق للمسار.",
      requirementState: "TO_VERIFY",
    },
    {
      id: "transit_route",
      category: "TRANSPORT",
      title: "خط السير والمطارات",
      why: "تغيير المطار أو المبنى يغير التعقيد التشغيلي وقد يغير متطلبات العبور.",
      nextAction: "ثبت المطارات والمباني والشركات ومدد التوقف.",
      requirementState: "PLANNING_ONLY",
      answerKey: "decision_transit_route",
    },
    {
      id: "transit_baggage",
      category: "TRANSPORT",
      title: "استلام/إعادة شحن الأمتعة",
      why: "قد يجبرك على مسار مختلف داخل المطار.",
      nextAction: "أكد Through Check أو Re-check من شركة الطيران/التذكرة.",
      requirementState: "PLANNING_ONLY",
      answerKey: "decision_transit_baggage",
      readyValues: ["through", "recheck"],
    },
    {
      id: "transit_time",
      category: "TRANSPORT",
      title: "مدة الربط والـMCT",
      why: "صلة لا تستخدم حدًا عالميًا للربط؛ MCT رسمي خاص بالمطار/الرحلة.",
      nextAction: "أكد MCT والمسافة/طريقة الانتقال من المطار أو شركة الطيران.",
      requirementState: "TO_VERIFY",
      answerKey: "decision_transit_layover_minutes",
    },
  ],
  other: [
    {
      id: "other_purpose",
      category: "PURPOSE",
      title: "مستند يشرح الغرض الحقيقي من الرحلة",
      why: "الغرض غير المصنف يحتاج توضيحًا قبل اختيار مسار دخول أو مستندات.",
      nextAction: "حدد سبب السفر والجهة المرتبطة به إن وجدت.",
      requirementState: "PLANNING_ONLY",
      answerKey: "other_purpose",
    },
    {
      id: "other_stay",
      category: "ACCOMMODATION",
      title: "خطة الإقامة",
      why: "تجهيز عملي وقد يصبح مستند دعم حسب المسار.",
      nextAction: "حدد مكان الإقامة وراجع هل يلزم إثبات رسمي.",
      requirementState: "TO_VERIFY",
    },
    {
      id: "other_return",
      category: "TRANSPORT",
      title: "خطة المغادرة",
      why: "قد تكون شرطًا أو سياقًا مهمًا حسب نوع الدخول.",
      nextAction: "أكد من المصدر الرسمي هل يلزم إثبات مغادرة.",
      requirementState: "TO_VERIFY",
    },
  ],
};

export function travelPreparationDefinition(
  purpose: TravelPurpose | null,
  id: string,
): Pick<TravelDossierItem, "id" | "category" | "title" | "why" | "nextAction"> | null {
  const template = [...COMMON, ...(purpose ? PURPOSE_TEMPLATES[purpose] : [])]
    .find((item) => item.id === id);
  if (!template) return null;
  return {
    id: template.id,
    category: template.category,
    title: template.title,
    why: template.why,
    nextAction: template.nextAction,
  };
}

function summary(evidence: Evidence): TravelDossierEvidenceSummary {
  return {
    sourceType: evidence.source.type,
    sourceLabel: evidence.source.label,
    sourceUrl: evidence.source.reference,
    evidenceStatus: evidence.status,
    checkedAt: evidence.checkedAt,
    validUntil: evidence.validUntil,
    scope: [...evidence.scope],
    limitations: [...evidence.limitations],
  };
}

function answer(input: TravelReadinessInput, key: string | undefined): string | null {
  if (!key) return null;
  const value = input.advisorAnswers?.[key]?.trim();
  return value || null;
}

function answerReadiness(template: Template, value: string | null): TravelDossierReadinessState {
  if (!template.answerKey) return "UNKNOWN";
  if (!value) return "NEEDS_TRAVELER_CONFIRMATION";
  const normalized = value.toLocaleLowerCase("en-US");
  if ((template.readyValues ?? []).some((candidate) => normalized === candidate.toLocaleLowerCase("en-US"))) {
    return "REPORTED_READY";
  }
  if ((template.actionValues ?? []).some((candidate) => normalized === candidate.toLocaleLowerCase("en-US"))) {
    return "NEEDS_ACTION";
  }
  if (["unknown", "غير متأكد", "غير محدد"].includes(normalized)) {
    return "UNKNOWN";
  }
  return "REPORTED_READY";
}

function evidenceRequirement(
  item: DynamicChecklistItem | undefined,
): Pick<TravelDossierItem, "requirementState" | "readinessState" | "evidence" | "limitations" | "nextAction"> | null {
  if (!item) return null;
  const evidence = summary(item.evidence);
  const reliable = item.evidence.status === "VERIFIED";

  if (item.id === "visa_requirement" && reliable) {
    if (item.status === "PENDING_ACTION") {
      return {
        requirementState: "CONFIRMED_REQUIRED",
        readinessState: "NEEDS_TRAVELER_CONFIRMATION",
        evidence,
        limitations: [...item.evidence.limitations],
        nextAction: "أكد هل التأشيرة المطلوبة صدرت بالفعل، وراجع صلاحيتها ونطاقها قبل السفر.",
      };
    }
    if (item.status === "VERIFIED") {
      return {
        requirementState: "CONFIRMED_NOT_REQUIRED",
        readinessState: "NOT_APPLICABLE",
        evidence,
        limitations: [...item.evidence.limitations],
        nextAction: item.nextAction,
      };
    }
  }

  if (item.id === "transit_visa" && reliable) {
    if (item.status === "PENDING_ACTION") {
      return {
        requirementState: "CONFIRMED_REQUIRED",
        readinessState: "NEEDS_TRAVELER_CONFIRMATION",
        evidence,
        limitations: [...item.evidence.limitations],
        nextAction: "أكد إصدار إذن/تأشيرة العبور المطلوبة قبل الاعتماد على خط السير.",
      };
    }
    if (item.status === "VERIFIED") {
      return {
        requirementState: "CONFIRMED_NOT_REQUIRED",
        readinessState: "NOT_APPLICABLE",
        evidence,
        limitations: [...item.evidence.limitations],
        nextAction: item.nextAction,
      };
    }
  }

  return {
    requirementState: "TO_VERIFY",
    readinessState:
      item.id === "passport_validity" && item.evidence.status === "REPORTED"
        ? "REPORTED_READY"
        : "UNKNOWN",
    evidence,
    limitations: [...item.evidence.limitations],
    nextAction: item.nextAction,
  };
}

function templateItem(
  template: Template,
  input: TravelReadinessInput,
  checklist: Map<string, DynamicChecklistItem>,
): TravelDossierItem {
  const linkedChecklistId =
    template.id === "passport"
      ? "passport_validity"
      : template.id === "entry_visa"
        ? "visa_requirement"
        : template.id === "transit_permission"
          ? "transit_visa"
          : null;
  const linked = linkedChecklistId ? evidenceRequirement(checklist.get(linkedChecklistId)) : null;
  const travelerReport = answer(input, template.answerKey);

  return {
    id: template.id,
    category: template.category,
    title: template.title,
    requirementState: linked?.requirementState ?? template.requirementState ?? "PLANNING_ONLY",
    readinessState: linked?.readinessState ?? answerReadiness(template, travelerReport),
    why: template.why,
    nextAction: linked?.nextAction ?? template.nextAction,
    travelerReport,
    evidence: linked?.evidence ?? null,
    limitations: linked?.limitations ?? (
      (template.requirementState ?? "PLANNING_ONLY") === "PLANNING_ONLY"
        ? ["هذا بند تخطيط عملي، وليس ادعاءً بأنه مطلوب رسميًا."]
        : ["لم يثبت هذا البند كمتطلب رسمي في الأدلة الحالية؛ يلزم تأكيده من المصدر المختص."]
    ),
  };
}

export function buildTravelPreparationDossier(
  input: TravelReadinessInput,
  result: TravelReadinessResult,
): TravelPreparationDossier {
  const checklist = new Map(result.checklist.map((item) => [item.id, item]));
  const purposeTemplates = input.travelPurpose ? PURPOSE_TEMPLATES[input.travelPurpose] : [];
  const templates = [...COMMON, ...purposeTemplates];
  const items = templates.map((template) => templateItem(template, input, checklist));

  return {
    purpose: input.travelPurpose ?? null,
    items,
    confirmedRequired: items
      .filter((item) => item.requirementState === "CONFIRMED_REQUIRED")
      .map((item) => item.id),
    travelerAction: items
      .filter((item) =>
        item.readinessState === "NEEDS_ACTION" ||
        item.readinessState === "NEEDS_TRAVELER_CONFIRMATION"
      )
      .map((item) => item.id),
    needsOfficialConfirmation: items
      .filter((item) => item.requirementState === "TO_VERIFY")
      .map((item) => item.id),
    planning: items
      .filter((item) => item.requirementState === "PLANNING_ONLY")
      .map((item) => item.id),
    generatedAt: result.evaluatedAt,
    limitations: [
      "قائمة التجهيز تجمع بين متطلبات مثبتة وخطوات تحتاج تحققًا وخطة عملية؛ حالة كل بند توضّح الفرق.",
      "إجابة المسافر قد تثبت أنه يملك/خطط لبند ما، لكنها لا تجعل البند شرطًا رسميًا.",
      "أي بند TO_VERIFY يحتاج مصدرًا رسميًا مطابقًا للجنسية والوجهة والغرض والتاريخ قبل اعتباره شرطًا.",
    ],
  };
}

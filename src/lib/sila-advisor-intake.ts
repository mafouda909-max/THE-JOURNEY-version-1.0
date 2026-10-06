export type SilaAdvisorFieldProvenance = "USER_STATED" | "INFERRED" | "UNKNOWN";
export type SilaAdvisorRole = "TRAVELER" | "AGENT" | "UNKNOWN";

export interface SilaAdvisorField {
  value: string | null;
  confidence: number;
  provenance: SilaAdvisorFieldProvenance;
  evidence: string | null;
}

export interface SilaAdvisorIntentDraft {
  originalMessage: string;
  role: SilaAdvisorRole;
  fields: {
    nationality: SilaAdvisorField;
    destination: SilaAdvisorField;
    purpose: SilaAdvisorField;
    dateWindow: SilaAdvisorField;
    travelers: SilaAdvisorField;
    budget: SilaAdvisorField;
    origin: SilaAdvisorField;
    transit: SilaAdvisorField;
    passportStatus: SilaAdvisorField;
    accommodation: SilaAdvisorField;
    returnTicket: SilaAdvisorField;
  };
}

export interface SilaAdvisorQuestion {
  id: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  question: string;
  why: string;
}

const UNKNOWN_FIELD: SilaAdvisorField = {
  value: null,
  confidence: 0,
  provenance: "UNKNOWN",
  evidence: null,
};

const stated = (value: string, evidence: string, confidence = 0.9): SilaAdvisorField => ({
  value,
  confidence,
  provenance: "USER_STATED",
  evidence,
});

const inferred = (value: string, evidence: string, confidence = 0.72): SilaAdvisorField => ({
  value,
  confidence,
  provenance: "INFERRED",
  evidence,
});

const includesAny = (message: string, terms: string[]) => terms.some((term) => message.includes(term));

const matchAny = (message: string, patterns: RegExp[]) => patterns.find((pattern) => pattern.test(message));

const monthPatterns: Array<[RegExp, string]> = [
  [/(?:شهر\s*)?12|ديسمبر|ديسمير|december/i, "ديسمبر"],
  [/(?:شهر\s*)?11|نوفمبر|november/i, "نوفمبر"],
  [/(?:شهر\s*)?10|اكتوبر|أكتوبر|october/i, "أكتوبر"],
  [/(?:شهر\s*)?9|سبتمبر|september/i, "سبتمبر"],
  [/(?:شهر\s*)?8|اغسطس|أغسطس|august/i, "أغسطس"],
  [/(?:شهر\s*)?7|يوليو|july/i, "يوليو"],
  [/(?:شهر\s*)?6|يونيو|june/i, "يونيو"],
  [/(?:شهر\s*)?5|مايو|may/i, "مايو"],
  [/(?:شهر\s*)?4|ابريل|أبريل|april/i, "أبريل"],
  [/(?:شهر\s*)?3|مارس|march/i, "مارس"],
  [/(?:شهر\s*)?2|فبراير|february/i, "فبراير"],
  [/(?:شهر\s*)?1|يناير|january/i, "يناير"],
];

const destinationPatterns: Array<[RegExp, string]> = [
  [/تركيا|اسطنبول|إسطنبول|istanbul|turkey/i, "تركيا"],
  [/السعودية|سعودية|عمرة|حج|مكة|المدينة|saudi/i, "السعودية"],
  [/اسبانيا|إسبانيا|spain/i, "إسبانيا"],
  [/ايطاليا|إيطاليا|italy/i, "إيطاليا"],
  [/اليابان|japan/i, "اليابان"],
  [/البحرين|bahrain/i, "البحرين"],
  [/الكويت|kuwait/i, "الكويت"],
  [/الامارات|الإمارات|دبي|ابوظبي|أبوظبي|uae|dubai/i, "الإمارات"],
];

function detectNationality(message: string): SilaAdvisorField {
  if (/(?:انا|أنا|عميل|العميل)?\s*(?:مصري|مصرى|مصرية|مصريه)|egyptian/i.test(message)) {
    return stated("مصري", "ذُكرت الجنسية المصرية في الرسالة");
  }
  if (/سعودي|سعودية|saudi/i.test(message)) return stated("سعودي", "ذُكرت الجنسية السعودية في الرسالة");
  return UNKNOWN_FIELD;
}

function detectDestination(message: string): SilaAdvisorField {
  const match = destinationPatterns.find(([pattern]) => pattern.test(message));
  if (!match) return UNKNOWN_FIELD;
  return stated(match[1], `ذُكرت الوجهة أو مدينة مرتبطة بها: ${match[1]}`);
}

function detectPurpose(message: string): SilaAdvisorField {
  if (/عمرة/i.test(message)) return stated("umrah", "ذُكر غرض العمرة");
  if (/حج/i.test(message)) return stated("hajj", "ذُكر غرض الحج");
  if (/سياحة|فسحة|رحلة|tourism|tourist/i.test(message)) return stated("tourism", "ذُكر غرض السياحة");
  if (/دراسة|تعليم|جامعة|مدرسة|study|student/i.test(message)) return stated("study", "ذُكر غرض الدراسة");
  if (/شغل|عمل|وظيفة|work|job/i.test(message)) return stated("work", "ذُكر غرض العمل");
  if (/بيزنس|تجارة|مؤتمر|business/i.test(message)) return stated("business", "ذُكر غرض الأعمال");
  if (/زيارة|قريب|عيلة|عائلي/i.test(message)) return stated("visit", "ذُكر غرض الزيارة");
  return UNKNOWN_FIELD;
}

function detectDateWindow(message: string): SilaAdvisorField {
  const month = monthPatterns.find(([pattern]) => pattern.test(message));
  if (month) return stated(month[1], `ذُكر توقيت السفر: ${month[1]}`);
  const dateMatch = message.match(/(?:يوم|بتاريخ|تاريخ)?\s*(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/);
  if (dateMatch) return stated(dateMatch[0].trim(), "ذُكر تاريخ رقمي في الرسالة");
  if (/قريب|قريبا|قريبًا/i.test(message)) return inferred("قريبًا", "المستخدم قال إن السفر قريب");
  return UNKNOWN_FIELD;
}

function detectTravelers(message: string): SilaAdvisorField {
  const familySignals = [];
  if (/(?:مراتي|زوجتي|زوجة|الزوجة)/.test(message)) familySignals.push("زوجة");
  if (/(?:جوزي|زوجي|زوج)/.test(message)) familySignals.push("زوج");
  if (/(?:طفلة|طفل|بيبي|رضيع|اولاد|أولاد|اطفال|أطفال)/.test(message)) familySignals.push("طفل/أطفال");
  if (familySignals.length > 0) {
    return stated(`المستخدم + ${familySignals.join(" + ")}`, "ذُكر سياق عائلي في الرسالة", 0.86);
  }
  const countMatch = message.match(/(\d+)\s*(?:افراد|أفراد|اشخاص|أشخاص|مسافرين|مسافر)/);
  if (countMatch) return stated(`${countMatch[1]} مسافرين`, "ذُكر عدد المسافرين");
  return UNKNOWN_FIELD;
}

function detectBudget(message: string): SilaAdvisorField {
  const limited = /ميزانية\s*(?:محدودة|قليلة|اقتصادية)|ارخص|أرخص|اقتصادي|اقتصادية/.test(message);
  if (limited) return stated("ميزانية محدودة/اقتصادية", "ذُكر قيد الميزانية");
  const money = message.match(/(?:ميزانية|budget|حوالي|تقريبا|تقريبًا)?\s*(\d[\d,\.\s]*)\s*(?:جنيه|دولار|ريال|درهم|egp|usd|sar|aed)/i);
  if (money) return stated(money[0].trim(), "ذُكرت قيمة ميزانية أو مبلغ");
  return UNKNOWN_FIELD;
}

function detectOrigin(message: string): SilaAdvisorField {
  const origin = message.match(/(?:من|طالع من|مسافر من)\s+(القاهرة|مصر|طنطا|الاسكندرية|الإسكندرية|المنصورة|جدة|الرياض|دبي|الكويت)/);
  if (origin) return stated(origin[1], "ذُكر مكان الانطلاق");
  if (/مصري|مصرى|مصرية|مصر/.test(message)) return inferred("مصر", "الجنسية/السياق المصري يرجح أن نقطة البداية مصر", 0.55);
  return UNKNOWN_FIELD;
}

function detectTransit(message: string): SilaAdvisorField {
  if (/ترانزيت|توقف|layover|transit/i.test(message)) return stated("مذكور ترانزيت/توقف", "ذُكر الترانزيت في الرسالة");
  return UNKNOWN_FIELD;
}

function detectPassportStatus(message: string): SilaAdvisorField {
  if (/جواز(?:ات)?\s*(?:ساري|سارية|صالحة|صالح)|passport.*valid/i.test(message)) return stated("الجواز مذكور كساري", "ذُكرت صلاحية الجواز");
  if (/جواز|باسبور|passport/i.test(message)) return stated("الجواز مذكور لكن الصلاحية غير واضحة", "ذُكر الجواز دون مدة الصلاحية", 0.62);
  return UNKNOWN_FIELD;
}

function detectAccommodation(message: string): SilaAdvisorField {
  if (/فندق|حجز|اقامة|إقامة|سكن|hotel|accommodation/i.test(message)) return stated("الإقامة/الحجز مذكور", "ذُكر السكن أو الحجز");
  return UNKNOWN_FIELD;
}

function detectReturnTicket(message: string): SilaAdvisorField {
  if (/عودة|ذهاب وعودة|رايح جاي|return ticket|round trip/i.test(message)) return stated("تذكرة عودة مذكورة", "ذُكرت العودة أو الذهاب والعودة");
  return UNKNOWN_FIELD;
}

export function extractSilaAdvisorIntent(message: string): SilaAdvisorIntentDraft {
  const cleanMessage = message.trim();
  const role: SilaAdvisorRole = includesAny(cleanMessage, ["عميل", "العميل", "زبون", "وكيل"])
    ? "AGENT"
    : cleanMessage
      ? "TRAVELER"
      : "UNKNOWN";

  return {
    originalMessage: cleanMessage,
    role,
    fields: {
      nationality: detectNationality(cleanMessage),
      destination: detectDestination(cleanMessage),
      purpose: detectPurpose(cleanMessage),
      dateWindow: detectDateWindow(cleanMessage),
      travelers: detectTravelers(cleanMessage),
      budget: detectBudget(cleanMessage),
      origin: detectOrigin(cleanMessage),
      transit: detectTransit(cleanMessage),
      passportStatus: detectPassportStatus(cleanMessage),
      accommodation: detectAccommodation(cleanMessage),
      returnTicket: detectReturnTicket(cleanMessage),
    },
  };
}

export function summarizeSilaAdvisorUnderstanding(intent: SilaAdvisorIntentDraft): string {
  const parts: string[] = [];
  const { fields } = intent;

  if (fields.nationality.value) parts.push(`جنسيتك/جنسية العميل: ${fields.nationality.value}`);
  if (fields.destination.value) parts.push(`الوجهة: ${fields.destination.value}`);
  if (fields.purpose.value) parts.push(`الغرض: ${purposeLabel(fields.purpose.value)}`);
  if (fields.dateWindow.value) parts.push(`التوقيت: ${fields.dateWindow.value}`);
  if (fields.travelers.value) parts.push(`المسافرون: ${fields.travelers.value}`);
  if (fields.budget.value) parts.push(`الميزانية: ${fields.budget.value}`);

  if (parts.length === 0) {
    return "فهمت إنك بتسأل عن سفر، لكن لسه محتاج أعرف الوجهة والغرض والجنسية عشان أوجهك صح.";
  }

  return `فهمت منك إن ${parts.join("، ")}.`;
}

export function selectSilaAdvisorMissingQuestions(intent: SilaAdvisorIntentDraft, limit = 4): SilaAdvisorQuestion[] {
  const { fields } = intent;
  const questions: SilaAdvisorQuestion[] = [];

  const addIfUnknown = (
    field: SilaAdvisorField,
    question: SilaAdvisorQuestion,
  ) => {
    if (!field.value) questions.push(question);
  };

  addIfUnknown(fields.nationality, {
    id: "nationality",
    priority: "HIGH",
    question: "جنسيتك أو جنسية العميل إيه؟",
    why: "شروط التأشيرة والدخول تختلف حسب الجنسية.",
  });
  addIfUnknown(fields.destination, {
    id: "destination",
    priority: "HIGH",
    question: "عايز تسافر لأي دولة أو مدينة؟",
    why: "الوجهة هي أساس شروط الدخول والتأشيرة والعروض.",
  });
  addIfUnknown(fields.purpose, {
    id: "purpose",
    priority: "HIGH",
    question: "الغرض من السفر إيه: سياحة، دراسة، عمل، عمرة، زيارة؟",
    why: "الغرض يغير المستندات والخطوات المطلوبة.",
  });
  addIfUnknown(fields.dateWindow, {
    id: "date-window",
    priority: "MEDIUM",
    question: "السفر إمتى تقريبًا؟ التاريخ ثابت ولا مرن؟",
    why: "التوقيت يؤثر على صلاحية المستندات والأسعار وتوفر العروض.",
  });

  if (fields.passportStatus.value === null) {
    questions.push({
      id: "passport-status",
      priority: "HIGH",
      question: "هل الجوازات سارية؟ ولو تعرف، فاضل كام شهر على الانتهاء؟",
      why: "صلاحية الجواز من أكثر الأسباب التي قد توقف الرحلة.",
    });
  }

  if (fields.travelers.value && fields.travelers.value.includes("طفل") && fields.travelers.confidence >= 0.7) {
    questions.push({
      id: "child-age",
      priority: "MEDIUM",
      question: "سن الطفل قد إيه؟",
      why: "سن الطفل يغير بعض ترتيبات الطيران والإقامة والتأمين والأوراق.",
    });
  }

  if (fields.purpose.value === "tourism" && fields.returnTicket.value === null) {
    questions.push({
      id: "return-ticket",
      priority: "MEDIUM",
      question: "هل ناوي تحجز ذهاب وعودة ولا لسه؟",
      why: "خطة العودة قد تؤثر على تقييم الجاهزية وبعض متطلبات الدخول.",
    });
  }

  return questions.slice(0, Math.max(1, limit));
}

export function firstSilaAdvisorStep(intent: SilaAdvisorIntentDraft): string {
  const questions = selectSilaAdvisorMissingQuestions(intent, 1);
  if (questions[0]) {
    return `أول خطوة: جاوب على سؤال واحد مهم — ${questions[0].question}`;
  }
  return "أول خطوة: نعمل فحص جاهزية مبدئي ونفصل المطلوب رسميًا عن النصائح العملية.";
}

function purposeLabel(value: string) {
  const labels: Record<string, string> = {
    tourism: "سياحة",
    study: "دراسة",
    work: "عمل",
    business: "أعمال",
    visit: "زيارة",
    umrah: "عمرة",
    hajj: "حج",
  };
  return labels[value] ?? value;
}

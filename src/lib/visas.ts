export type VisaType = "visa_free" | "evisa" | "on_arrival" | "embassy_required";

export interface VerifiedVisaGuide {
  id: number;
  nationalityCountry: string; // e.g. "مصر", "المملكة العربية السعودية"
  destinationCountry: string; // e.g. "تركيا", "جورجيا", "المالديف"
  destinationCountryEn: string; // e.g. "Turkey", "Georgia", "Maldives"
  destinationSlug: string; // e.g. "turkey", "georgia", "maldives"
  visaType: VisaType;
  visaTypeLabel: string;
  entryRequirements: string[];
  stayDurationDays: number;
  officialPortalUrl: string;
  officialSourceName: string;
  lastVerifiedAt: string; // ISO date string
  notes?: string;
  airportProcedures?: string;
  isVerified: boolean;
}

export const VERIFIED_VISA_GUIDES: VerifiedVisaGuide[] = [
  {
    id: 1,
    nationalityCountry: "مصر",
    destinationCountry: "تركيا",
    destinationCountryEn: "Turkey",
    destinationSlug: "turkey",
    visaType: "evisa",
    visaTypeLabel: "تأشيرة إلكترونية (eVisa) / ملصق سفارة",
    entryRequirements: [
      "جواز سفر ساري المفعول لمدة لا تقل عن 6 أشهر من تاريخ الوصول.",
      "تأشيرة شنغن، أمريكا، بريطانيا أو إيرلندا سارية (لإصدار التأشيرة الإلكترونية الفورية خلال دقائق).",
      "تذكرة طيران ذهاب وعودة مؤكدة مع إحدى خطوط الطيران المعتمدة.",
      "حجز فندقي مؤكد يغطي فترة الإقامة في تركيا.",
      "تأمين سفر طبي يغطي فترة الإقامة وحالات الطوارئ.",
    ],
    stayDurationDays: 30,
    officialPortalUrl: "https://www.evisa.gov.tr",
    officialSourceName: "وزارة الخارجية لجمهورية تركيا (Republic of Türkiye Ministry of Foreign Affairs)",
    lastVerifiedAt: "2026-03-15T10:00:00.000Z",
    notes: "المسافرون الذين لا يحملون تأشيرة مؤهلة (شنغن/أمريكا) يلزمهم التقديم عبر المركز المعتمد (Gateway Visa) للحصول على ملصق التأشيرة قبل السفر.",
    airportProcedures: "في مطار إسطنبول (IST) ومطار صبيحة (SAW)، يتوجه حاملو التأشيرة الإلكترونية المطبوعة مباشرة إلى كاونترات الجوازات الدولية مع إبراز الجواز وتذكرة العودة.",
    isVerified: true,
  },
  {
    id: 2,
    nationalityCountry: "مصر",
    destinationCountry: "المملكة العربية السعودية",
    destinationCountryEn: "Saudi Arabia",
    destinationSlug: "saudi-arabia",
    visaType: "evisa",
    visaTypeLabel: "تأشيرة إلكترونية / منصة التأشيرات الموحدة",
    entryRequirements: [
      "جواز سفر ساري لأكثر من 6 أشهر.",
      "تأشيرة سياحية إلكترونية لحاملي إقامات الخليج أو تأشيرات أمريكا/شنغن/بريطانيا المستخدمة، أو تأشيرة زيارة عائلية/شخصية عبر ksavisa.sa.",
      "تأمين طبي معتمد يغطي مخاطر كورونا وحالات الطوارئ (يُصدر تلقائياً مع التأشيرة).",
      "تذكرة عودة مؤكدة وإثبات مكان الإقامة.",
    ],
    stayDurationDays: 90,
    officialPortalUrl: "https://visa.visitsaudi.com",
    officialSourceName: "وزارة الخارجية السعودية وهيئة السياحة السعودية (Visit Saudi)",
    lastVerifiedAt: "2026-03-20T12:00:00.000Z",
    notes: "تسمح التأشيرة السياحية بأداء مناسك العمرة في غير موسم الحج، وزيارة كافة مدن المملكة.",
    airportProcedures: "التسجيل في البوابات الآلية أو كاونترات الجوازات لأخذ الخصائص الحيوية (البصمة والصورة) عند أول دخول.",
    isVerified: true,
  },
  {
    id: 3,
    nationalityCountry: "مصر",
    destinationCountry: "الإمارات",
    destinationCountryEn: "United Arab Emirates",
    destinationSlug: "united-arab-emirates",
    visaType: "evisa",
    visaTypeLabel: "تأشيرة إلكترونية مسبقة (30 أو 60 يوماً)",
    entryRequirements: [
      "جواز سفر صالح لمدة لا تقل عن 6 أشهر.",
      "صورة شخصية حديثة بخلفية بيضاء.",
      "تأشيرة إلكترونية صادرة عبر الإدارة العامة للإقامة وشؤون الأجانب (GDRFA) أو الهيئة الاتحادية (ICP).",
      "تذكرة عودة مؤكدة وتأمين صحي للسفر.",
      "حجز فندق أو عنوان مقر الإقامة في الدولة.",
    ],
    stayDurationDays: 30,
    officialPortalUrl: "https://smartservices.icp.gov.ae",
    officialSourceName: "الهيئة الاتحادية للهوية والجنسية والجمارك وأمن المنافذ (ICP)",
    lastVerifiedAt: "2026-03-10T14:00:00.000Z",
    notes: "يمكن إصدار التأشيرة عبر شركات الطيران الإماراتية (طيران الإمارات، فلاي دبي، الاتحاد، العربية) أو عبر وكيل سفر موثّق.",
    airportProcedures: "المسافرون القادمون إلى مطارات دبي وأبوظبي يمرون عبر بوابات الهوية الذكية أو الجوازات مع مسح باركود التأشيرة الإلكترونية.",
    isVerified: true,
  },
  {
    id: 4,
    nationalityCountry: "مصر",
    destinationCountry: "جورجيا",
    destinationCountryEn: "Georgia",
    destinationSlug: "georgia",
    visaType: "evisa",
    visaTypeLabel: "تأشيرة إلكترونية / إعفاء لمقيمي الخليج وشنغن",
    entryRequirements: [
      "جواز سفر ساري المفعول لمدة لا تقل عن 3 أشهر بعد انتهاء صلاحية التأشيرة.",
      "تأشيرة إلكترونية (eVisa) صادرة من البوابة القنصلية الرسمية لجورجيا.",
      "إعفاء فوري من التأشيرة (دخول لمدة 90 يوماً) لحاملي إقامة سارية في دول مجلس التعاون الخليجي أو تأشيرة شنغن/أمريكا/بريطانيا سارية المفعول.",
      "وثيقة تأمين سفر صحي إلزامي مطبوعة.",
      "تذكرة عودة وحجز إقامة فندقية مؤكد وكشف حساب بنكي يثبت الملاءة المالية.",
    ],
    stayDurationDays: 30,
    officialPortalUrl: "https://www.evisa.gov.ge",
    officialSourceName: "وزارة الشؤون الخارجية لجمهورية جورجيا (MFA Georgia)",
    lastVerifiedAt: "2026-03-25T09:00:00.000Z",
    notes: "شرطة الحدود الجورجية تدقق بشكل حازم في وجود التأمين الصحي المطبوع وتذكرة العودة والحجز الفندقي.",
    airportProcedures: "عند الوصول إلى مطار تبليسي الدولي (TBS) أو باتومي (BUS)، يجب تقديم النسخ الورقية المطبوعة للتأمين والحجز الفندقي والتذكرة لموظف الجوازات.",
    isVerified: true,
  },
  {
    id: 5,
    nationalityCountry: "المملكة العربية السعودية",
    destinationCountry: "جورجيا",
    destinationCountryEn: "Georgia",
    destinationSlug: "georgia",
    visaType: "visa_free",
    visaTypeLabel: "دخول بدون تأشيرة (حتى 365 يوماً)",
    entryRequirements: [
      "جواز سفر سعودي ساري المفعول لمدة تغطي فترة الإقامة المخططة.",
      "تأمين سفر طبي يغطي فترة الرحلة (موصى به وإلزامي لحالات الطوارئ).",
      "تذكرة عودة أو متابعة السفر.",
      "حجز فندقي مؤكد.",
    ],
    stayDurationDays: 365,
    officialPortalUrl: "https://www.geoconsul.gov.ge",
    officialSourceName: "وزارة الشؤون الخارجية لجمهورية جورجيا",
    lastVerifiedAt: "2026-03-22T11:00:00.000Z",
    notes: "يُعفى مواطنو المملكة العربية السعودية من شرط الحصول على تأشيرة مسبقة ويحق لهم الإقامة لمدة تصل إلى عام كامل.",
    airportProcedures: "إجراءات دخول سريعة في مطار تبليسي الدولي عبر مسار الدول المعفاة من التأشيرة.",
    isVerified: true,
  },
  {
    id: 6,
    nationalityCountry: "المملكة العربية السعودية",
    destinationCountry: "تركيا",
    destinationCountryEn: "Turkey",
    destinationSlug: "turkey",
    visaType: "visa_free",
    visaTypeLabel: "دخول بدون تأشيرة (حتى 90 يوماً)",
    entryRequirements: [
      "جواز سفر سعودي ساري المفعول لمدة لا تقل عن 6 أشهر.",
      "تذكرة عودة وحجز فندق مؤكد.",
      "تأمين سفر يغطي فترة الإقامة.",
    ],
    stayDurationDays: 90,
    officialPortalUrl: "https://www.evisa.gov.tr",
    officialSourceName: "وزارة الخارجية التركية",
    lastVerifiedAt: "2026-03-20T08:00:00.000Z",
    notes: "تم إعفاء المواطنين السعوديين من التأشيرة السياحية للإقامات التي لا تتجاوز 90 يوماً خلال كل 180 يوماً بموجب المرسوم الرئاسي.",
    airportProcedures: "المرور المباشر إلى كاونترات الجوازات دون الحاجة لشراء أو طباعة أي لاصق تأشيرة مسبق.",
    isVerified: true,
  },
  {
    id: 7,
    nationalityCountry: "مصر",
    destinationCountry: "المالديف",
    destinationCountryEn: "Maldives",
    destinationSlug: "maldives",
    visaType: "on_arrival",
    visaTypeLabel: "تأشيرة مجانية عند الوصول (30 يوماً)",
    entryRequirements: [
      "جواز سفر صالح لمدة لا تقل عن 6 أشهر.",
      "تعبئة إقرار المسافر الصحي (IMUGA) إلكترونياً خلال 96 ساعة قبل موعد الوصول والمغادرة.",
      "تذكرة عودة مؤكدة وتأكيد حجز منتجع أو فندق مسجل رسمياً.",
      "إثبات ملاءة مالية لتغطية فترة الإقامة (100 دولار + 50 دولار لكل يوم، أو حجز شامل).",
    ],
    stayDurationDays: 30,
    officialPortalUrl: "https://imuga.immigration.gov.mv",
    officialSourceName: "دائرة الهجرة المالديفية (Maldives Immigration)",
    lastVerifiedAt: "2026-03-18T16:00:00.000Z",
    notes: "التأشيرة مجانية تماماً عند الوصول لكافة الجنسيات. الشرط الحاسم هو تعبئة استمارة IMUGA إلكترونياً قبل الإقلاع.",
    airportProcedures: "في مطار فيلانا الدولي (MLE) في ماليه، يُظهر المسافر رمز الـ QR الخاص باستمارة IMUGA مع الجواز لموظف الهجرة لختم الدخول.",
    isVerified: true,
  },
];

export function listVisaGuides(params?: {
  nationality?: string;
  destination?: string;
}): VerifiedVisaGuide[] {
  let list = VERIFIED_VISA_GUIDES;

  if (params?.nationality?.trim()) {
    const nat = params.nationality.trim().toLowerCase();
    list = list.filter((g) => g.nationalityCountry.toLowerCase().includes(nat));
  }

  if (params?.destination?.trim()) {
    const dest = params.destination.trim().toLowerCase();
    list = list.filter(
      (g) =>
        g.destinationCountry.toLowerCase().includes(dest) ||
        g.destinationCountryEn.toLowerCase().includes(dest) ||
        g.destinationSlug.toLowerCase().includes(dest),
    );
  }

  return list;
}

export function getVisaGuide(destinationSlugOrCountry: string, nationality = "مصر"): VerifiedVisaGuide | null {
  const destNeedle = destinationSlugOrCountry.trim().toLowerCase();
  const natNeedle = nationality.trim().toLowerCase();

  const found = VERIFIED_VISA_GUIDES.find(
    (g) =>
      (g.destinationSlug.toLowerCase() === destNeedle ||
        g.destinationCountry.toLowerCase() === destNeedle ||
        g.destinationCountryEn.toLowerCase() === destNeedle) &&
      g.nationalityCountry.toLowerCase().includes(natNeedle),
  );

  if (found) return found;

  // Fallback: match destination regardless of nationality
  return (
    VERIFIED_VISA_GUIDES.find(
      (g) =>
        g.destinationSlug.toLowerCase() === destNeedle ||
        g.destinationCountry.toLowerCase() === destNeedle ||
        g.destinationCountryEn.toLowerCase() === destNeedle,
    ) ?? null
  );
}

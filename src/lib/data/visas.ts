import { createClient } from "@/lib/supabase/server";
import type { PublicVisaGuideRow } from "./types";

const FALLBACK_VISA_GUIDES: PublicVisaGuideRow[] = [
  {
    id: "visa-tr-01",
    destination_country_id: "c-tr",
    destination_country_name_ar: "تركيا",
    destination_country_name_en: "Turkey",
    destination_country_iso2: "TR",
    origin_country_id: "c-sa",
    origin_country_name_ar: "المملكة العربية السعودية",
    origin_country_name_en: "Saudi Arabia",
    origin_country_iso2: "SA",
    visa_type: "e_visa",
    title_ar: "التأشيرة الإلكترونية السياحية لتركيا (e-Visa)",
    title_en: "Turkey Tourist e-Visa",
    summary_ar:
      "تأشيرة إلكترونية ميسرة وفورية تصدر مباشرة عبر البوابة الرسمية للحكومة التركية في دقائق دون الحاجة لأي وسطاء أو زيارة قنصلية.",
    summary_en: "Official immediate electronic visa issued via Republic of Turkey portal.",
    requirements_ar: [
      "جواز سفر ساري المفعول لمدة لا تقل عن 6 أشهر من تاريخ الدخول",
      "تذكرة طيران ذهاب وعودة مؤكدة",
      "حجز فندقي أو عنوان إقامة واضح في تركيا",
      "بطاقة بنكية لدفع الرسوم الحكومية إلكترونياً",
    ],
    documents_required: ["صورة واضحة لصفحة بيانات جواز السفر", "بريد إلكتروني نشط لتلقي ملف التأشيرة"],
    processing_time_days: 1,
    validity_days: 180,
    stay_duration_days: 90,
    cost_estimate: 225,
    currency: "SAR",
    official_portal_url: "https://www.evisa.gov.tr",
    official_source_name: "البوابة الرسمية للتأشيرة الإلكترونية لجمهورية تركيا (وزارة الخارجية)",
    is_official_verified: true,
    last_verified_at: "2026-10-01T00:00:00Z",
    notes_ar: "احذر من الروابط الإعلانية المزيفة وتأكد دائماً من الدخول عبر نطاق gov.tr الرسمي.",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  },
  {
    id: "visa-ge-01",
    destination_country_id: "c-ge",
    destination_country_name_ar: "جورجيا",
    destination_country_name_en: "Georgia",
    destination_country_iso2: "GE",
    origin_country_id: "c-sa",
    origin_country_name_ar: "المملكة العربية السعودية",
    origin_country_name_en: "Saudi Arabia",
    origin_country_iso2: "SA",
    visa_type: "visa_free",
    title_ar: "إعفاء الدخول إلى جورجيا لمواطني ومقيمي دول الخليج",
    title_en: "Georgia Visa Exemption for GCC Citizens & Residents",
    summary_ar:
      "دخول حر بدون تأشيرة مسبقة لمواطني دول مجلس التعاون الخليجي وحاملي الإقامات الخليجية السارية لمدة تصل إلى عام كامل.",
    summary_en: "Visa-free entry for up to 365 days for GCC nationals and valid residency holders.",
    requirements_ar: [
      "جواز سفر ساري المفعول طوال فترة الإقامة في جورجيا",
      "تأمين طبي شامل يغطي الحوادث والطوارئ (متطلب إلزامي عند الجوازات)",
      "حجز طيران للعودة وحجز سكن مبدئي",
      "إثبات ملاءة مالية أو بطاقة ائتمان سارية",
    ],
    documents_required: ["جواز السفر الأصلي", "وثيقة التأمين الصحي باللغة الإنجليزية"],
    processing_time_days: 0,
    validity_days: 365,
    stay_duration_days: 360,
    cost_estimate: 0,
    currency: "SAR",
    official_portal_url: "https://www.geoconsul.gov.ge",
    official_source_name: "البوابة القنصلية الرسمية لوزارة الشؤون الخارجية بجورجيا",
    is_official_verified: true,
    last_verified_at: "2026-10-01T00:00:00Z",
    notes_ar: "التأمين الصحي أصبح متطلباً مشدداً في مطارات جورجيا اعتباراً من التحديثات الأخيرة.",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  },
  {
    id: "visa-gb-01",
    destination_country_id: "c-gb",
    destination_country_name_ar: "المملكة المتحدة",
    destination_country_name_en: "United Kingdom",
    destination_country_iso2: "GB",
    origin_country_id: "c-sa",
    origin_country_name_ar: "المملكة العربية السعودية",
    origin_country_name_en: "Saudi Arabia",
    origin_country_iso2: "SA",
    visa_type: "eta",
    title_ar: "تصريح السفر الإلكتروني البريطاني (UK ETA)",
    title_en: "UK Electronic Travel Authorisation (ETA)",
    summary_ar:
      "نظام رسمي حديث يتيح السفر المتعدد إلى بريطانيا لمدة سنتين برسوم منخفضة وطلب يقدم في دقائق عبر التطبيق أو الموقع الحكومي.",
    summary_en: "Modern digital travel permit for multi-entry UK visits up to 2 years.",
    requirements_ar: [
      "جواز سفر بيومتري ساري المفعول",
      "صورة شخصية حديثة ملتقطة بكاميرا الهاتف بجودة عالية",
      "الإجابة على مجموعة من الأسئلة الأمنية البسيطة",
      "بطاقة دفع إلكترونية لسداد الرسم الحكومي البالغ 10 جنيهات إسترلينية",
    ],
    documents_required: ["جواز السفر البيومتري", "صورة شخصية رقمية"],
    processing_time_days: 3,
    validity_days: 730,
    stay_duration_days: 180,
    cost_estimate: 60,
    currency: "SAR",
    official_portal_url: "https://www.gov.uk/electronic-travel-authorisation-eta",
    official_source_name: "بوابة وزارة الداخلية للحكومة البريطانية (GOV.UK)",
    is_official_verified: true,
    last_verified_at: "2026-10-01T00:00:00Z",
    notes_ar: "يغني بالكامل عن التأشيرة التقليدية لزيارات السياحة والعمل وزيارة الأقارب حتى 6 أشهر في كل رحلة.",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  },
  {
    id: "visa-sch-01",
    destination_country_id: "c-fr",
    destination_country_name_ar: "دول الشنغن (أوروبا)",
    destination_country_name_en: "Schengen Area",
    destination_country_iso2: "EU",
    origin_country_id: "c-sa",
    origin_country_name_ar: "المملكة العربية السعودية",
    origin_country_name_en: "Saudi Arabia",
    origin_country_iso2: "SA",
    visa_type: "embassy_visa",
    title_ar: "دليل تأشيرة شنغن الموحدة (Schengen Visa - Type C)",
    title_en: "Uniform Schengen Visa Guide",
    summary_ar:
      "تأشيرة الدخول الموحدة التي تسمح بزيارة 29 دولة أوروبية والتنقل بينها بحرية. تتطلب حجز موعد وبصمة بيومترية في مركز التأشيرات المعتمد.",
    summary_en: "Unified tourist visa for 29 European member states requiring biometrics and appointment.",
    requirements_ar: [
      "جواز سفر ساري المفعول لمدة لا تقل عن 3 أشهر بعد تاريخ مغادرة منطقة شنغن",
      "وثيقة تأمين سفر شنغن معتمدة بتغطية طبية لا تقل عن 30,000 يورو",
      "كشف حساب بنكي رسمي مختوم لآخر 3 إلى 6 أشهر يوضح حركة الحساب",
      "خطاب تعريف بالراتب أو السجل التجاري مترجم للإنجليزية",
      "حجز طيران مبدئي وحجوزات فندقية تغطي كامل مسار الرحلة",
    ],
    documents_required: [
      "جواز السفر الأصلي وجوازات السفر السابقة إن وجدت",
      "صورتان شخصيتان حديثتان مقاس 3.5x4.5 بخلفية بيضاء",
      "نموذج طلب التأشيرة معبأ وموقع",
      "تأمين السفر وكشف الحساب البنكي",
    ],
    processing_time_days: 15,
    validity_days: 90,
    stay_duration_days: 90,
    cost_estimate: 375,
    currency: "SAR",
    official_portal_url: "https://home-affairs.ec.europa.eu/policies/schengen-borders-and-visa_en",
    official_source_name: "المفوضية الأوروبية للشؤون الداخلية وسياسة الشنغن الرسمية",
    is_official_verified: true,
    last_verified_at: "2026-10-01T00:00:00Z",
    notes_ar: "قدم طلبك لدى سفارة الدولة التي ستقضي فيها المدة الأطول، أو دولة الدخول الأولى في حال تساوي المدد.",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  },
  {
    id: "visa-th-01",
    destination_country_id: "c-th",
    destination_country_name_ar: "تايلاند",
    destination_country_name_en: "Thailand",
    destination_country_iso2: "TH",
    origin_country_id: "c-sa",
    origin_country_name_ar: "المملكة العربية السعودية",
    origin_country_name_en: "Saudi Arabia",
    origin_country_iso2: "SA",
    visa_type: "visa_free",
    title_ar: "إعفاء مواطني السعودية والخليج من تأشيرة تايلاند",
    title_en: "Thailand Visa Exemption Scheme",
    summary_ar:
      "يتمتع مواطنو السعودية والإمارات بعدة تحديثات تسمح بالإقامة السياحية دون تأشيرة مسبقة حتى 60 يوماً قابلة للتمديد داخل تايلاند.",
    summary_en: "Visa exemption allowing up to 60 days stay for tourism purposes.",
    requirements_ar: [
      "جواز سفر ساري لمدة 6 أشهر على الأقل",
      "تذكرة طيران مؤكدة لمغادرة تايلاند خلال مدة الإقامة المسموحة",
      "إثبات محل الإقامة الفندقي",
      "مبلغ كافي لتغطية الإقامة (10,000 بات للفرد أو 20,000 بات للعائلة)",
    ],
    documents_required: ["جواز السفر الأصلي", "بطاقة الصعود وتذكرة المغادرة"],
    processing_time_days: 0,
    validity_days: 60,
    stay_duration_days: 60,
    cost_estimate: 0,
    currency: "SAR",
    official_portal_url: "https://www.thaievisa.go.th",
    official_source_name: "البوابة الرسمية للتأشيرات التايلاندية (وزارة الخارجية)",
    is_official_verified: true,
    last_verified_at: "2026-10-01T00:00:00Z",
    notes_ar: "يمكن تمديد الإقامة لمدة 30 يوماً إضافية من خلال مكاتب الجوازات في بانكوك أو بوكيت.",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  },
];

export async function listVisaGuidesServer(params?: {
  destinationIso?: string;
  visaType?: string;
  query?: string;
}): Promise<PublicVisaGuideRow[]> {
  try {
    const supabase = await createClient();
    let query = supabase.from("public_visa_guides").select("*");

    if (params?.visaType) {
      query = query.eq("visa_type", params.visaType);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      return filterFallbackGuides(params);
    }

    let guides = data as PublicVisaGuideRow[];
    if (params?.destinationIso) {
      guides = guides.filter(
        (g) => g.destination_country_iso2?.toLowerCase() === params.destinationIso?.toLowerCase(),
      );
    }
    if (params?.query) {
      const q = params.query.toLowerCase();
      guides = guides.filter(
        (g) =>
          g.title_ar?.toLowerCase().includes(q) ||
          g.destination_country_name_ar?.toLowerCase().includes(q) ||
          g.summary_ar?.toLowerCase().includes(q),
      );
    }
    return guides;
  } catch {
    return filterFallbackGuides(params);
  }
}

function filterFallbackGuides(params?: {
  destinationIso?: string;
  visaType?: string;
  query?: string;
}): PublicVisaGuideRow[] {
  let list = [...FALLBACK_VISA_GUIDES];
  if (params?.visaType) {
    list = list.filter((g) => g.visa_type === params.visaType);
  }
  if (params?.destinationIso) {
    list = list.filter(
      (g) => g.destination_country_iso2.toLowerCase() === params.destinationIso?.toLowerCase(),
    );
  }
  if (params?.query) {
    const q = params.query.toLowerCase();
    list = list.filter(
      (g) =>
        g.title_ar.toLowerCase().includes(q) ||
        g.destination_country_name_ar.toLowerCase().includes(q) ||
        g.summary_ar.toLowerCase().includes(q),
    );
  }
  return list;
}

export async function getVisaGuideByIdServer(id: string): Promise<PublicVisaGuideRow | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("public_visa_guides")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return FALLBACK_VISA_GUIDES.find((g) => g.id === id) || null;
    }
    return data as PublicVisaGuideRow;
  } catch {
    return FALLBACK_VISA_GUIDES.find((g) => g.id === id) || null;
  }
}

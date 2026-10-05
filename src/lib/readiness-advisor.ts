import { getPublishedOffers, type OfferWithAgent } from "@/lib/data";
import { aiProvider, travelWebProvider } from "@/lib/provider-gateway";
import type { TravelPurpose, TravelReadinessInput } from "@/lib/travel-readiness";
import { evidenceSourceUrl } from "@/lib/evidence";

export type AdvisorResearchStatus =
  | "AVAILABLE"
  | "SOURCES_ONLY"
  | "NOT_CONFIGURED"
  | "UNAVAILABLE";

export interface AdvisorResearchSource {
  title: string;
  url: string;
  sourceType: "SOURCE_REPORTED";
}

export interface AdvisorLiveResearch {
  status: AdvisorResearchStatus;
  answer: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW" | null;
  sources: AdvisorResearchSource[];
  checkedAt: string;
  limitations: string[];
}

export interface AdvisorOfferRecommendation {
  id: number;
  title: string;
  href: string;
  destination: string;
  priceAmount: number;
  currency: string;
  priceType: string;
  agentName: string;
  matchReasons: string[];
  confirmationNeeded: string[];
}

export interface ReadinessAdvisorResult {
  purpose: TravelPurpose | null;
  purposeLabel: string;
  questionsToComplete: string[];
  preparationTopics: string[];
  liveResearch: AdvisorLiveResearch;
  offers: AdvisorOfferRecommendation[];
  offerSearchStatus: "AVAILABLE" | "NO_MATCH" | "UNAVAILABLE";
  limitations: string[];
}

const PURPOSE_LABELS: Record<TravelPurpose, string> = {
  tourism: "سياحة",
  study: "دراسة",
  work: "عمل بعقد أو وظيفة",
  business: "رحلة عمل أو اجتماعات",
  freelance: "عمل حر أو عن بُعد",
  umrah: "عمرة",
  visit: "زيارة عائلية أو شخصية",
  medical: "علاج",
  transit: "ترانزيت",
  other: "غرض آخر",
};

type PurposeGuide = {
  questions: string[];
  topics: string[];
  preferredTripTypes: string[];
};

const PURPOSE_GUIDES: Record<TravelPurpose, PurposeGuide> = {
  tourism: {
    questions: [
      "هل حجزت الإقامة أم ما زالت مرنة؟",
      "هل لديك تذكرة عودة أو سفر لاحق؟",
      "هل لديك ترانزيت أو تغيير مطار؟",
    ],
    topics: ["الدخول والتأشيرة", "الإقامة والعودة", "التأمين والصحة", "الوصول من المطار", "الميزانية ووسيلة الدفع"],
    preferredTripTypes: ["package", "flight", "hotel", "visa"],
  },
  study: {
    questions: [
      "هل لديك قبول نهائي من جهة تعليمية؟",
      "ما مدة البرنامج وتاريخ بدايته؟",
      "هل طُلب منك إثبات تمويل أو سكن أو تأمين؟",
    ],
    topics: ["قبول الدراسة", "تأشيرة أو إقامة الطالب", "إثبات التمويل", "التأمين", "السكن", "إجراءات الوصول والتسجيل"],
    preferredTripTypes: ["visa", "flight", "hotel", "package"],
  },
  work: {
    questions: [
      "هل لديك عقد عمل أو عرض وظيفي نهائي؟",
      "هل يوجد صاحب عمل أو كفيل مسؤول عن الإجراء؟",
      "هل طُلب فحص طبي أو صحيفة حالة جنائية أو تصديقات؟",
    ],
    topics: ["تصريح أو تأشيرة العمل", "العقد والكفيل", "الفحوص والتصديقات", "الإقامة بعد الوصول", "السفر الأول والسكن"],
    preferredTripTypes: ["visa", "flight", "hotel"],
  },
  business: {
    questions: [
      "هل الزيارة لاجتماعات فقط أم ستؤدي عملًا فعليًا داخل الدولة؟",
      "هل لديك دعوة من شركة أو معرض أو مؤتمر؟",
      "كم مدة الزيارة؟",
    ],
    topics: ["نوع تصريح الزيارة المناسب", "الدعوة والمستندات", "الدخول والعودة", "المطار والتنقل", "الفواتير والمدفوعات"],
    preferredTripTypes: ["visa", "flight", "hotel", "package"],
  },
  freelance: {
    questions: [
      "هل ستعمل عن بُعد أثناء الإقامة أم الغرض الأساسي سياحة؟",
      "من أين يأتي دخلك أو عملاؤك؟",
      "كم مدة الإقامة المخططة؟",
    ],
    topics: ["قانونية العمل عن بُعد", "تأشيرة الرحلة مقابل تصاريح العمل", "الإقامة الرقمية إن وجدت", "الضرائب والإقامة عند الحاجة لمختص", "الاتصال والإنترنت"],
    preferredTripTypes: ["visa", "flight", "hotel", "package"],
  },
  umrah: {
    questions: [
      "ما تاريخ السفر المتوقع ومطار الوصول؟",
      "هل الرحلة إلى مكة فقط أم مكة والمدينة؟",
      "هل لديك ترانزيت أو توقف طويل؟",
    ],
    topics: ["مسار الدخول للسعودية", "متطلبات العمرة الحالية", "الصحة والتطعيمات", "نُسك والتصاريح عند انطباقها", "الإحرام والميقات حسب خط السير", "مطار الوصول والنقل إلى مكة أو المدينة"],
    preferredTripTypes: ["umrah", "flight", "visa", "hotel", "package"],
  },
  visit: {
    questions: [
      "من الشخص أو الجهة التي ستزورها؟",
      "هل تحتاج دعوة أو إثبات علاقة حسب نوع الزيارة؟",
      "أين ستقيم وكم مدة الزيارة؟",
    ],
    topics: ["نوع الزيارة", "الدعوة أو إثبات العلاقة", "الإقامة", "العودة أو السفر اللاحق", "التأمين والصحة"],
    preferredTripTypes: ["visa", "flight", "hotel", "package"],
  },
  medical: {
    questions: [
      "هل لديك موعد أو خطاب من جهة علاجية؟",
      "هل تحتاج مرافقًا؟",
      "هل تحمل أدوية أو تقارير تحتاج ترجمة أو تصريحًا؟",
    ],
    topics: ["موعد الجهة العلاجية", "التأشيرة أو خطاب الدعم", "الأدوية والتقارير", "التأمين والدفع", "المرافق", "النقل من المطار"],
    preferredTripTypes: ["visa", "flight", "hotel", "package"],
  },
  transit: {
    questions: [
      "ما خط السير الكامل وشركات الطيران؟",
      "هل ستغير مبنى أو مطارًا؟",
      "هل الأمتعة مشحونة حتى الوجهة النهائية أم ستستلمها؟",
    ],
    topics: ["تأشيرة الترانزيت", "Airside مقابل Landside", "تغيير المطار أو المبنى", "الأمتعة وإعادة الشحن", "مدة الربط", "إجراءات شركة الطيران"],
    preferredTripTypes: ["flight", "visa"],
  },
  other: {
    questions: [
      "اشرح الغرض من الرحلة بجملة واحدة حتى لا نطبّق قواعد غرض مختلف.",
      "كم مدة الإقامة؟",
      "هل توجد جهة مضيفة أو مستند يشرح سبب السفر؟",
    ],
    topics: ["تحديد الغرض القانوني للرحلة", "الدخول والتأشيرة", "المستندات", "الإقامة والعودة", "المطار والترانزيت"],
    preferredTripTypes: ["visa", "flight", "hotel", "package"],
  },
};

function normalize(value: string | undefined | null): string {
  return (value ?? "").trim().toLocaleLowerCase("en-US");
}

function destinationMatches(input: TravelReadinessInput, offer: OfferWithAgent): boolean {
  const needle = normalize(input.destination);
  if (!needle) return false;
  return [
    offer.destinationCity,
    offer.destinationCountry,
    offer.destinationCountryEn,
    offer.title,
  ].some((value) => normalize(value).includes(needle) || needle.includes(normalize(value)));
}

export function rankReadinessOffers(
  input: TravelReadinessInput,
  offers: OfferWithAgent[],
): AdvisorOfferRecommendation[] {
  const guide = input.travelPurpose ? PURPOSE_GUIDES[input.travelPurpose] : null;
  return offers
    .flatMap((offer, index) => {
      if (!destinationMatches(input, offer)) return [];
      let score = 10;
      const matchReasons = [`الوجهة تطابق بحثك عن ${input.destination}`];
      const confirmationNeeded: string[] = [
        "أكد السعر والتوافر النهائيين مع الوكيل قبل الدفع أو الالتزام.",
      ];

      if (guide?.preferredTripTypes.includes(offer.tripType)) {
        score += 3;
        matchReasons.push(`نوع العرض قريب من غرض الرحلة: ${PURPOSE_LABELS[input.travelPurpose!]}`);
      }
      if (input.originCity && normalize(offer.originCity).includes(normalize(input.originCity))) {
        score += 2;
        matchReasons.push(`الانطلاق يطابق ${input.originCity}`);
      }
      if (
        input.budgetAmount !== undefined &&
        input.budgetCurrency &&
        offer.currency === input.budgetCurrency
      ) {
        if (offer.priceAmount <= input.budgetAmount) {
          score += 2;
          matchReasons.push("السعر المعلن داخل الميزانية التي أدخلتها بنفس العملة.");
        } else {
          confirmationNeeded.push("السعر المعلن أعلى من الميزانية التي أدخلتها.");
        }
      } else if (input.budgetAmount !== undefined && input.budgetCurrency) {
        confirmationNeeded.push("عملة العرض مختلفة؛ لم تُجرَ مقارنة سعرية بدون تحويل موثوق ومؤرّخ.");
      }

      return [{
        score,
        index,
        value: {
          id: offer.id,
          title: offer.title,
          href: `/offers/${offer.id}`,
          destination: `${offer.destinationCity}، ${offer.destinationCountry}`,
          priceAmount: offer.priceAmount,
          currency: offer.currency,
          priceType: offer.priceType,
          agentName: offer.agent.displayName,
          matchReasons,
          confirmationNeeded,
        } satisfies AdvisorOfferRecommendation,
      }];
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .map((item) => item.value);
}

function researchQuestion(input: TravelReadinessInput): string {
  const purpose = input.travelPurpose ? PURPOSE_LABELS[input.travelPurpose] : "غير محدد";
  return [
    `مسافر جنسيته ${input.nationality} يريد السفر إلى ${input.destination} لغرض ${purpose}.`,
    input.travelDate ? `تاريخ السفر المتوقع ${input.travelDate}.` : "",
    input.transitCountry ? `يوجد ترانزيت في ${input.transitCountry}.` : "",
    input.originCity ? `مدينة الانطلاق ${input.originCity}.` : "",
    "ابحث في المصادر الحالية، وفضّل الجهات الحكومية والهجرة والسفارات والمطارات وشركات الطيران.",
    "لخّص فقط ما تدعمه المصادر عن: مستندات الدخول، التأشيرة، صلاحية الجواز، الترانزيت، الصحة أو التأمين، المتطلبات الخاصة بغرض السفر، المطارات وخيارات الوصول، وأي تفاصيل عملية قد تمنع خطأ قبل السفر.",
    "افصل بوضوح بين شرط رسمي وبين نصيحة عملية، ولا تعتبر نتيجة بحث ويب تصريح سفر أو ضمان دخول.",
  ].filter(Boolean).join(" ");
}

async function liveResearch(
  input: TravelReadinessInput,
  signal?: AbortSignal,
): Promise<AdvisorLiveResearch> {
  const checkedAt = new Date().toISOString();
  const baseLimitations = [
    "البحث المباشر لا يغيّر حكم الـChecklist الموثق تلقائيًا.",
    "أي معلومة ويب غير منظمة تظل بحاجة إلى تأكيد من المصدر المختص قبل الحجز والسفر.",
  ];

  if (!travelWebProvider.isConfigured()) {
    return {
      status: "NOT_CONFIGURED",
      answer: null,
      confidence: null,
      sources: [],
      checkedAt,
      limitations: [...baseLimitations, "البحث المباشر غير مفعّل في بيئة التشغيل الحالية."],
    };
  }

  try {
    const search = await travelWebProvider.search(
      researchQuestion(input),
      { maxResults: 6, searchDepth: "advanced" },
      signal,
    );
    const sources = search.results.flatMap((item) => {
      const url = evidenceSourceUrl(item.url);
      return url ? [{
        title: item.title.slice(0, 180),
        url,
        sourceType: "SOURCE_REPORTED" as const,
      }] : [];
    });

    if (sources.length === 0) {
      return {
        status: "UNAVAILABLE",
        answer: null,
        confidence: null,
        sources: [],
        checkedAt: search.retrievedAt,
        limitations: [...baseLimitations, "لم يرجع البحث مصدرًا صالحًا للعرض."],
      };
    }

    if (!aiProvider.isConfigured()) {
      return {
        status: "SOURCES_ONLY",
        answer: null,
        confidence: null,
        sources,
        checkedAt: search.retrievedAt,
        limitations: [...baseLimitations, "تم العثور على مصادر مباشرة، لكن طبقة التلخيص المدعومة بالأدلة غير مفعلة."],
      };
    }

    const synthesis = await aiProvider.synthesizeTravelIntel(
      {
        question: researchQuestion(input),
        untrustedWebContext: travelWebProvider.formatAsUntrustedContext(search),
      },
      signal,
    );
    return {
      status: synthesis.sourcesUsed.length > 0 ? "AVAILABLE" : "SOURCES_ONLY",
      answer: synthesis.sourcesUsed.length > 0 ? synthesis.answer : null,
      confidence: synthesis.sourcesUsed.length > 0 ? synthesis.confidence : null,
      sources,
      checkedAt: search.retrievedAt,
      limitations: baseLimitations,
    };
  } catch {
    return {
      status: "UNAVAILABLE",
      answer: null,
      confidence: null,
      sources: [],
      checkedAt,
      limitations: [...baseLimitations, "تعذر الوصول إلى البحث المباشر في هذه المحاولة."],
    };
  }
}

export async function buildReadinessAdvisor(
  input: TravelReadinessInput,
  signal?: AbortSignal,
): Promise<ReadinessAdvisorResult> {
  const purpose = input.travelPurpose ?? null;
  const guide = purpose ? PURPOSE_GUIDES[purpose] : null;
  const questionsToComplete = [
    ...(!purpose ? ["ما الغرض الأساسي من السفر؟"] : []),
    ...(guide?.questions ?? []),
    ...(!input.travelDate ? ["ما تاريخ السفر المتوقع؟"] : []),
    ...(!input.originCity ? ["من أي مدينة ستبدأ الرحلة؟"] : []),
  ];

  const [research, offerResult] = await Promise.all([
    liveResearch(input, signal),
    getPublishedOffers()
      .then((offers) => ({ ok: true as const, offers: rankReadinessOffers(input, offers) }))
      .catch(() => ({ ok: false as const, offers: [] as AdvisorOfferRecommendation[] })),
  ]);

  return {
    purpose,
    purposeLabel: purpose ? PURPOSE_LABELS[purpose] : "لم يُحدد بعد",
    questionsToComplete: [...new Set(questionsToComplete)].slice(0, 8),
    preparationTopics: guide?.topics ?? [
      "التأشيرة والدخول",
      "صلاحية الجواز",
      "الترانزيت",
      "المستندات",
      "المطار والوصول",
    ],
    liveResearch: research,
    offers: offerResult.offers,
    offerSearchStatus: !offerResult.ok
      ? "UNAVAILABLE"
      : offerResult.offers.length > 0
        ? "AVAILABLE"
        : "NO_MATCH",
    limitations: [
      "اقتراحات التجهيز هي خطة بحث ومراجعة وليست ادعاءً بأن كل بند مطلوب قانونًا.",
      "العروض المقترحة تأتي فقط من العرض العام الحالي في صلة؛ عدم وجود تطابق لا يعني عدم وجود خيارات خارج المنصة.",
    ],
  };
}

export { PURPOSE_LABELS };

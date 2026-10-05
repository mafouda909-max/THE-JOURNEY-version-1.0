import type { OfferWithAgent } from "@/lib/data";
import type { TravelPurpose, TravelReadinessInput } from "@/lib/travel-readiness";

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

export const PURPOSE_LABELS: Record<TravelPurpose, string> = {
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

export type PurposeGuide = {
  questions: string[];
  topics: string[];
  preferredTripTypes: string[];
};

export const PURPOSE_GUIDES: Record<TravelPurpose, PurposeGuide> = {
  tourism: {
    questions: ["هل حجزت الإقامة أم ما زالت مرنة؟", "هل لديك تذكرة عودة أو سفر لاحق؟", "هل لديك ترانزيت أو تغيير مطار؟"],
    topics: ["الدخول والتأشيرة", "الإقامة والعودة", "التأمين والصحة", "الوصول من المطار", "الميزانية ووسيلة الدفع"],
    preferredTripTypes: ["package", "flight", "hotel", "visa"],
  },
  study: {
    questions: ["هل لديك قبول نهائي من جهة تعليمية؟", "ما مدة البرنامج وتاريخ بدايته؟", "هل طُلب منك إثبات تمويل أو سكن أو تأمين؟"],
    topics: ["قبول الدراسة", "تأشيرة أو إقامة الطالب", "إثبات التمويل", "التأمين", "السكن", "إجراءات الوصول والتسجيل"],
    preferredTripTypes: ["visa", "flight", "hotel", "package"],
  },
  work: {
    questions: ["هل لديك عقد عمل أو عرض وظيفي نهائي؟", "هل يوجد صاحب عمل أو كفيل مسؤول عن الإجراء؟", "هل طُلب فحص طبي أو صحيفة حالة جنائية أو تصديقات؟"],
    topics: ["تصريح أو تأشيرة العمل", "العقد والكفيل", "الفحوص والتصديقات", "الإقامة بعد الوصول", "السفر الأول والسكن"],
    preferredTripTypes: ["visa", "flight", "hotel"],
  },
  business: {
    questions: ["هل الزيارة لاجتماعات فقط أم ستؤدي عملًا فعليًا داخل الدولة؟", "هل لديك دعوة من شركة أو معرض أو مؤتمر؟", "كم مدة الزيارة؟"],
    topics: ["نوع تصريح الزيارة المناسب", "الدعوة والمستندات", "الدخول والعودة", "المطار والتنقل", "الفواتير والمدفوعات"],
    preferredTripTypes: ["visa", "flight", "hotel", "package"],
  },
  freelance: {
    questions: ["هل ستعمل عن بُعد أثناء الإقامة أم الغرض الأساسي سياحة؟", "من أين يأتي دخلك أو عملاؤك؟", "كم مدة الإقامة المخططة؟"],
    topics: ["قانونية العمل عن بُعد", "تأشيرة الرحلة مقابل تصاريح العمل", "الإقامة الرقمية إن وجدت", "الضرائب والإقامة عند الحاجة لمختص", "الاتصال والإنترنت"],
    preferredTripTypes: ["visa", "flight", "hotel", "package"],
  },
  umrah: {
    questions: ["ما تاريخ السفر المتوقع ومطار الوصول؟", "هل الرحلة إلى مكة فقط أم مكة والمدينة؟", "هل لديك ترانزيت أو توقف طويل؟"],
    topics: ["مسار الدخول للسعودية", "متطلبات العمرة الحالية", "الصحة والتطعيمات", "نُسك والتصاريح عند انطباقها", "الإحرام والميقات حسب خط السير", "مطار الوصول والنقل إلى مكة أو المدينة"],
    preferredTripTypes: ["umrah", "flight", "visa", "hotel", "package"],
  },
  visit: {
    questions: ["من الشخص أو الجهة التي ستزورها؟", "هل تحتاج دعوة أو إثبات علاقة حسب نوع الزيارة؟", "أين ستقيم وكم مدة الزيارة؟"],
    topics: ["نوع الزيارة", "الدعوة أو إثبات العلاقة", "الإقامة", "العودة أو السفر اللاحق", "التأمين والصحة"],
    preferredTripTypes: ["visa", "flight", "hotel", "package"],
  },
  medical: {
    questions: ["هل لديك موعد أو خطاب من جهة علاجية؟", "هل تحتاج مرافقًا؟", "هل تحمل أدوية أو تقارير تحتاج ترجمة أو تصريحًا؟"],
    topics: ["موعد الجهة العلاجية", "التأشيرة أو خطاب الدعم", "الأدوية والتقارير", "التأمين والدفع", "المرافق", "النقل من المطار"],
    preferredTripTypes: ["visa", "flight", "hotel", "package"],
  },
  transit: {
    questions: ["ما خط السير الكامل وشركات الطيران؟", "هل ستغير مبنى أو مطارًا؟", "هل الأمتعة مشحونة حتى الوجهة النهائية أم ستستلمها؟"],
    topics: ["تأشيرة الترانزيت", "Airside مقابل Landside", "تغيير المطار أو المبنى", "الأمتعة وإعادة الشحن", "مدة الربط", "إجراءات شركة الطيران"],
    preferredTripTypes: ["flight", "visa"],
  },
  other: {
    questions: ["اشرح الغرض من الرحلة بجملة واحدة حتى لا نطبّق قواعد غرض مختلف.", "كم مدة الإقامة؟", "هل توجد جهة مضيفة أو مستند يشرح سبب السفر؟"],
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
  return [offer.destinationCity, offer.destinationCountry, offer.destinationCountryEn, offer.title]
    .some((value) => {
      const candidate = normalize(value);
      return Boolean(candidate) && (candidate.includes(needle) || needle.includes(candidate));
    });
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
      const confirmationNeeded = ["أكد السعر والتوافر النهائيين مع الوكيل قبل الدفع أو الالتزام."];

      if (input.travelPurpose && guide?.preferredTripTypes.includes(offer.tripType)) {
        score += 3;
        matchReasons.push(`نوع العرض قريب من غرض الرحلة: ${PURPOSE_LABELS[input.travelPurpose]}`);
      }
      if (input.originCity && normalize(offer.originCity).includes(normalize(input.originCity))) {
        score += 2;
        matchReasons.push(`الانطلاق يطابق ${input.originCity}`);
      }
      if (input.budgetAmount !== undefined && input.budgetCurrency && offer.currency === input.budgetCurrency) {
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

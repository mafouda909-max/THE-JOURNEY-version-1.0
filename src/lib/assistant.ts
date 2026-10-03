import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { offers, agents } from "@/db/schema";
import { travelIntelService } from "@/lib/travel-intel";
import { travelReadinessEngine, TravelReadinessResult } from "@/lib/travel-readiness";
import { claimCheckerEngine, OfferClaimsResult } from "@/lib/claim-checker";

export interface TravelAssistantParams {
  userQuestion: string;
  pageContext?: {
    pageType: "HOME" | "OFFER" | "DESTINATION" | "ACCOUNT";
    offerId?: number;
    destinationCountry?: string;
  };
  travelerContext?: {
    nationality?: string;
    destination?: string;
    passportValidityMonths?: number;
    travelDates?: string;
    transitCountry?: string;
  };
}

export interface TravelAssistantResponse {
  answer: string;
  missingContextFields: string[];
  requiresUserAction: boolean;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  provenance: Array<{ title: string; url: string; sourceType: string }>;
  readinessResult?: TravelReadinessResult;
  offerAuditResult?: OfferClaimsResult;
  trustExplanation?: {
    verifiedClaims: string[];
    agentClaims: string[];
    staleClaims: string[];
    confirmationNeeded: string[];
  };
  safetyWarning?: string;
}

function missingReadinessContext(params: TravelAssistantParams): string[] {
  const missing: string[] = [];
  if (!params.travelerContext?.nationality?.trim()) missing.push("الجنسية الحالية للمسافر");
  if (!(params.travelerContext?.destination || params.pageContext?.destinationCountry)?.trim()) missing.push("وجهة السفر المقررة");
  if (params.travelerContext?.passportValidityMonths === undefined) missing.push("عدد الأشهر المتبقية في صلاحية الجواز");
  return missing;
}

export class AITravelAssistant {
  public async processQuery(params: TravelAssistantParams): Promise<TravelAssistantResponse> {
    const qLower = params.userQuestion.toLowerCase();
    const missing: string[] = [];
    const readinessQuery = qLower.includes("جاهز") || qLower.includes("readiness") || qLower.includes("جاهزية");

    if (qLower.includes("فيزا") || qLower.includes("تأشيرة") || qLower.includes("visa") || qLower.includes("شروط")) {
      if (!params.travelerContext?.nationality?.trim()) missing.push("الجنسية الحالية للمسافر");
      const dest = params.travelerContext?.destination || params.pageContext?.destinationCountry;
      if (!dest?.trim()) missing.push("وجهة السفر المقررة");
    }

    if (qLower.includes("جواز") || qLower.includes("صلاحية") || qLower.includes("passport")) {
      if (params.travelerContext?.passportValidityMonths === undefined) {
        missing.push("عدد الأشهر المتبقية في صلاحية الجواز");
      }
    }

    if (readinessQuery) {
      for (const field of missingReadinessContext(params)) {
        if (!missing.includes(field)) missing.push(field);
      }
    }

    if (missing.length > 0) {
      return {
        answer: `لا يمكن إعطاء حكم دقيق قبل معرفة: (${missing.join("، ")}). أضف هذه البيانات أولًا؛ لن نفترض جنسية أو وجهة أو صلاحية جواز من عندنا.`,
        missingContextFields: missing,
        requiresUserAction: true,
        confidence: "LOW",
        provenance: [],
        safetyWarning: "اشتراطات الدخول والجواز تختلف حسب جنسية المسافر والوجهة وتاريخ الرحلة؛ أي إجابة بدون هذه البيانات قد تكون مضللة.",
      };
    }

    if (
      (qLower.includes("موثوق") || qLower.includes("trustworthy") || qLower.includes("ناقص") || qLower.includes("فحص")) &&
      params.pageContext?.offerId
    ) {
      const now = new Date();
      const offerRows = await db
        .select({ offer: offers })
        .from(offers)
        .innerJoin(agents, eq(offers.agentId, agents.id))
        .where(
          and(
            eq(offers.id, params.pageContext.offerId),
            eq(offers.status, "published"),
            eq(agents.verificationStatus, "verified"),
            or(isNull(offers.expiresAt), gt(offers.expiresAt, now)),
          ),
        )
        .limit(1);

      const offer = offerRows[0]?.offer;
      if (!offer) {
        return {
          answer: "لا أستطيع فحص هذا العرض لأنه غير متاح للعامة حاليًا أو لم يعد صالحًا للعرض.",
          missingContextFields: [],
          requiresUserAction: false,
          confidence: "HIGH",
          provenance: [],
        };
      }

      const claimsAudit = await claimCheckerEngine.verifyOfferClaims({
        title: offer.title,
        description: offer.description,
        includes: offer.includes,
        originCity: offer.originCity,
        destinationCity: offer.destinationCity,
        destinationCountry: offer.destinationCountry,
      });

      const verifiedClaims = claimsAudit.evaluatedClaims
        .filter((claim) => claim.status === "VERIFIED" || claim.status === "SOURCE_REPORTED")
        .map((claim) => claim.claimText);
      const agentClaims = claimsAudit.evaluatedClaims
        .filter((claim) => claim.status === "AGENT_REPORTED")
        .map((claim) => claim.claimText);
      const unknownClaims = claimsAudit.evaluatedClaims
        .filter((claim) => claim.status === "UNKNOWN" || claim.status === "CONFLICTED")
        .map((claim) => claim.claimText);
      const confirmationNeeded = [
        ...unknownClaims,
        ...(offer.includes.length === 0 ? ["تفاصيل المشمولات الدقيقة"] : []),
      ];

      const summary = claimsAudit.evaluatedClaims.length === 0
        ? "لم يلتقط التحليل النصي ادعاءات خاصة تحتاج تصنيفًا، لكن هذا لا يثبت السعر أو التوفر خارجيًا."
        : `رصد التحليل ${claimsAudit.evaluatedClaims.length} ادعاء/ادعاءات في النص؛ ${agentClaims.length} منها مقدمة من الوكيل و${unknownClaims.length} تحتاج دليلًا خارجيًا قبل الاعتماد عليها.`;

      return {
        answer: `فحصنا شفافية نص العرض «${offer.title}». ${summary} توثيق الوكيل يثبت هوية/أهلية الوكيل وفق أدلة المنصة، ولا يعني أن السعر أو التوفر أو كل تفاصيل الرحلة متحققة لحظيًا من المورد.`,
        missingContextFields: [],
        requiresUserAction: confirmationNeeded.length > 0,
        confidence: "MEDIUM",
        provenance: [],
        offerAuditResult: claimsAudit,
        trustExplanation: {
          verifiedClaims,
          agentClaims,
          staleClaims: [],
          confirmationNeeded,
        },
        safetyWarning: "تحليل العرض هنا يفحص النص وتصنيف الادعاءات فقط؛ لا يحل محل تأكيد المورد أو المصدر الرسمي عند الحاجة.",
      };
    }

    if (readinessQuery) {
      const destination = (params.travelerContext?.destination || params.pageContext?.destinationCountry)!;
      const readiness = await travelReadinessEngine.evaluateReadiness({
        nationality: params.travelerContext!.nationality!,
        passportValidityMonths: params.travelerContext!.passportValidityMonths!,
        destination,
        transitCountry: params.travelerContext?.transitCountry,
      });

      return {
        answer: `تقييم الجاهزية إلى ${destination}: ${readiness.status}. النتيجة مبنية على البيانات التي قدمتها وعلى الأدلة المتاحة للمحرك؛ راجع أي بند غير مؤكد قبل السفر.`,
        missingContextFields: readiness.missingInformation,
        requiresUserAction: readiness.status !== "READY" || readiness.missingInformation.length > 0,
        confidence: readiness.missingInformation.length === 0 ? "MEDIUM" : "LOW",
        provenance: [],
        readinessResult: readiness,
        safetyWarning: "الجاهزية ليست تصريح سفر ولا ضمان دخول؛ القواعد قد تتغير ويجب الرجوع للمصدر الرسمي للقرارات الحساسة.",
      };
    }

    const destination = params.travelerContext?.destination || params.pageContext?.destinationCountry;
    const fullQuery = destination ? `${params.userQuestion} (الوجهة: ${destination})` : params.userQuestion;
    const intel = await travelIntelService.queryTravelIntel(fullQuery);
    const confidence = intel.confidence === "HIGH" || intel.confidence === "MEDIUM" || intel.confidence === "LOW"
      ? intel.confidence
      : "LOW";

    return {
      answer: intel.answer,
      missingContextFields: [],
      requiresUserAction: false,
      confidence,
      provenance: (intel.provenance || []).map((source) => ({
        title: source.title,
        url: source.url,
        sourceType: source.sourceType,
      })),
    };
  }
}

export const aiTravelAssistant = new AITravelAssistant();

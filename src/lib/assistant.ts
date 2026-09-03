import { travelIntelService } from "@/lib/travel-intel";
import { travelReadinessEngine, TravelReadinessResult } from "@/lib/travel-readiness";
import { claimCheckerEngine, OfferClaimsResult } from "@/lib/claim-checker";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { offers, agents } from "@/db/schema";
import { AIContextAssembly } from "@/lib/ai/context";

/**
 * AI TRAVEL ASSISTANT — CUSTOMER UX & PRODUCT INNOVATION ENGINE
 *
 * Integrated Assistant with Safety Gates, Provenance, Travel Readiness, and Offer Audit Explanations.
 */

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

export class AITravelAssistant {
  public async processQuery(params: TravelAssistantParams): Promise<TravelAssistantResponse> {
    const qLower = params.userQuestion.toLowerCase();
    const missing: string[] = [];

    // Safety Gate 1: Check required context for Visa / Entry questions
    if (qLower.includes("فيزا") || qLower.includes("تأشيرة") || qLower.includes("visa") || qLower.includes("شروط")) {
      if (!params.travelerContext?.nationality) missing.push("الجنسية الحالية للمسافر");
      const dest = params.travelerContext?.destination || params.pageContext?.destinationCountry;
      if (!dest) missing.push("وجهة السفر المقررة");
    }

    // Safety Gate 2: Check required context for Passport Validity questions
    if (qLower.includes("جواز") || qLower.includes("صلاحية") || qLower.includes("passport")) {
      if (params.travelerContext?.passportValidityMonths === undefined) {
        missing.push("عدد الأشهر المتبقية في صلاحية الجواز");
      }
    }

    // If critical safety context is missing for visa/passport queries, prompt traveler safely
    if (missing.length > 0) {
      return {
        answer: `للإجابة بدقة وأمان وفق القواعد الرسمية، ينقصنا معرفة: (${missing.join("، ")}). يرجى توضيح هذه البيانات لتقديم الاشتراطات الرسمية المعتمدة.`,
        missingContextFields: missing,
        requiresUserAction: true,
        confidence: "LOW",
        provenance: [],
        safetyWarning: "اشتراطات الجواز والتأشيرات تعتمد كلياً على جنسية المسافر ومدة الصلاحية المتبقية.",
      };
    }

    // Special Query Mode 1: Offer Trustworthiness & Claims Audit ("هل هذا العرض موثوق؟" / "ما الناقص في العرض؟")
    if (
      (qLower.includes("موثوق") || qLower.includes("trustworthy") || qLower.includes("ناقص") || qLower.includes("فحص")) &&
      params.pageContext?.offerId
    ) {
      const offerRows = await db
        .select()
        .from(offers)
        .where(eq(offers.id, params.pageContext.offerId))
        .limit(1);

      const offer = offerRows[0];
      if (offer) {
        const claimsAudit = await claimCheckerEngine.verifyOfferClaims({
          title: offer.title,
          description: offer.description,
          includes: offer.includes,
          originCity: offer.originCity,
          destinationCity: offer.destinationCity,
          destinationCountry: offer.destinationCountry,
        });

        const verifiedClaims = claimsAudit.evaluatedClaims
          .filter((c) => c.status === "VERIFIED" || c.status === "SOURCE_REPORTED")
          .map((c) => c.claimText);

        const agentClaims = claimsAudit.evaluatedClaims
          .filter((c) => c.status === "AGENT_REPORTED")
          .map((c) => c.claimText);

        const confirmationNeeded = offer.includes.length === 0 ? ["تفاصيل المشمولات الدقيقة"] : [];

        return {
          answer: `تم فحص شفافية العرض "${offer.title}". درجة الموثوقية الشاملة: ${claimsAudit.overallTrustScore}/100. ${
            agentClaims.length > 0
              ? `يتضمن العرض ادعاءات مقدّمة من الوكيل المحلي: (${agentClaims.join("، ")}).`
              : "جميع المشمولات والأسعار موضحة بشكل كامل."
          }`,
          missingContextFields: [],
          requiresUserAction: false,
          confidence: "HIGH",
          provenance: [],
          offerAuditResult: claimsAudit,
          trustExplanation: {
            verifiedClaims,
            agentClaims,
            staleClaims: [],
            confirmationNeeded,
          },
        };
      }
    }

    // Special Query Mode 2: Travel Readiness Check ("هل أنا جاهز للسفر؟" / "جاهزية السفر")
    if (qLower.includes("جاهز") || qLower.includes("readiness") || qLower.includes("جاهزية")) {
      const dest = params.travelerContext?.destination || params.pageContext?.destinationCountry || "السعودية";
      const readiness = await travelReadinessEngine.evaluateReadiness({
        nationality: params.travelerContext?.nationality || "سعودي",
        passportValidityMonths: params.travelerContext?.passportValidityMonths ?? 12,
        destination: dest,
        transitCountry: params.travelerContext?.transitCountry,
      });

      return {
        answer: `تقييم جاهزية السفر إلى ${dest}: الحالة [${readiness.status}]. تم إنشاء قائمة الفحص الديناميكية لرحلتك بنسبة جاهزية ${readiness.overallScore}%.`,
        missingContextFields: readiness.missingInformation,
        requiresUserAction: readiness.status !== "READY",
        confidence: "HIGH",
        provenance: [],
        readinessResult: readiness,
      };
    }

    // Standard Query: Query web-grounded Travel Intelligence via Tavily + OpenRouter synthesis
    const dest = params.travelerContext?.destination || params.pageContext?.destinationCountry;
    const fullQuery = dest ? `${params.userQuestion} (الوجهة: ${dest})` : params.userQuestion;

    const intel = await travelIntelService.queryTravelIntel(fullQuery);
    const conf = (intel.confidence === "HIGH" || intel.confidence === "MEDIUM" || intel.confidence === "LOW") ? intel.confidence : "LOW";

    return {
      answer: intel.answer,
      missingContextFields: [],
      requiresUserAction: false,
      confidence: conf,
      provenance: (intel.provenance || []).map((p) => ({
        title: p.title,
        url: p.url,
        sourceType: p.sourceType,
      })),
    };
  }
}

export const aiTravelAssistant = new AITravelAssistant();

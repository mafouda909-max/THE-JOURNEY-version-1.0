/**
 * OFFER CLAIM DISCLOSURE ANALYZER
 *
 * This module detects claims in agent-authored copy and classifies the evidence
 * actually available to THE JOURNEY. It does not invent external verification.
 * A claim can only be VERIFIED or SOURCE_REPORTED when a separate trusted source
 * is explicitly supplied by a future integration.
 */

export type ClaimStatus =
  | "VERIFIED"
  | "SOURCE_REPORTED"
  | "AGENT_REPORTED"
  | "STALE"
  | "CONFLICTED"
  | "UNKNOWN";

export interface ClaimEvaluationItem {
  claimText: string;
  claimType: "VISA_FREE" | "DIRECT_FLIGHT" | "BAGGAGE_ALLOWANCE" | "PRICE_GUARANTEE" | "AVAILABILITY" | "HOTEL_CONFIRMATION";
  status: ClaimStatus;
  confidenceScore: number;
  evidenceReason: string;
}

export interface OfferClaimsResult {
  /** Text-disclosure signal only. Never present this as external trust/verification. */
  overallTrustScore: number;
  scoreMeaning: "DISCLOSURE_ONLY";
  evaluatedClaims: ClaimEvaluationItem[];
  conflictCount: number;
}

export class ClaimCheckerEngine {
  public async verifyOfferClaims(offer: {
    title: string;
    description: string;
    includes: string[];
    originCity: string;
    destinationCity: string;
    destinationCountry: string;
  }): Promise<OfferClaimsResult> {
    const claims: ClaimEvaluationItem[] = [];
    const textToScan = `${offer.title} ${offer.description} ${offer.includes.join(" ")}`.toLowerCase();

    if (textToScan.includes("بدون فيزا") || textToScan.includes("visa free") || textToScan.includes("بدون تأشيرة")) {
      claims.push({
        claimText: "إعفاء من التأشيرة (Visa Free)",
        claimType: "VISA_FREE",
        status: "AGENT_REPORTED",
        confidenceScore: 0.2,
        evidenceReason: "ادعاء وارد في نص الوكيل فقط. يلزم مصدر رسمي حديث وجنسية المسافر قبل اعتباره متحققًا.",
      });
    }

    if (textToScan.includes("طيران مباشر") || textToScan.includes("direct flight") || textToScan.includes("بدون توقف")) {
      claims.push({
        claimText: "طيران مباشر بدون توقف",
        claimType: "DIRECT_FLIGHT",
        status: "AGENT_REPORTED",
        confidenceScore: 0.3,
        evidenceReason: "ادعاء وارد في العرض. لا توجد في هذا الفحص بيانات جدول طيران/GDS تثبته خارجيًا.",
      });
    }

    if (textToScan.includes("وزن 30") || textToScan.includes("30kg") || textToScan.includes("أمتعة 30")) {
      claims.push({
        claimText: "وزن أمتعة 30 كجم",
        claimType: "BAGGAGE_ALLOWANCE",
        status: "AGENT_REPORTED",
        confidenceScore: 0.3,
        evidenceReason: "مذكور من الوكيل في تفاصيل العرض. يجب تأكيده من شروط التذكرة/شركة الطيران قبل الاعتماد عليه.",
      });
    }

    if (textToScan.includes("أقل سعر") || textToScan.includes("lowest price") || textToScan.includes("أرخص سعر")) {
      claims.push({
        claimText: "ادعاء أقل/أرخص سعر",
        claimType: "PRICE_GUARANTEE",
        status: "UNKNOWN",
        confidenceScore: 0.05,
        evidenceReason: "لا توجد مقارنة سوقية موثوقة ومؤرخة تثبت هذا الادعاء؛ لا يجب عرضه كحقيقة متحققة.",
      });
    }

    if (textToScan.includes("متاح الآن") || textToScan.includes("توفر مضمون") || textToScan.includes("guaranteed availability")) {
      claims.push({
        claimText: "ادعاء توفر/إتاحة",
        claimType: "AVAILABILITY",
        status: "UNKNOWN",
        confidenceScore: 0.05,
        evidenceReason: "THE JOURNEY لا يملك مخزونًا لحظيًا يثبت التوفر؛ يحتاج تأكيدًا مباشرًا من الوكيل/المورد.",
      });
    }

    if (textToScan.includes("فندق مؤكد") || textToScan.includes("hotel confirmed") || textToScan.includes("حجز مؤكد")) {
      claims.push({
        claimText: "تأكيد إقامة الفندق",
        claimType: "HOTEL_CONFIRMATION",
        status: "AGENT_REPORTED",
        confidenceScore: 0.25,
        evidenceReason: "ادعاء مقدم من الوكيل. لا توجد في هذا الفحص قسيمة/تأكيد مورد خارجي يثبته.",
      });
    }

    const conflictCount = claims.filter((claim) => claim.status === "CONFLICTED").length;
    const disclosureScore = claims.length === 0
      ? 0
      : Math.round((claims.reduce((sum, claim) => sum + claim.confidenceScore, 0) / claims.length) * 100);

    return {
      overallTrustScore: disclosureScore,
      scoreMeaning: "DISCLOSURE_ONLY",
      evaluatedClaims: claims,
      conflictCount,
    };
  }
}

export const claimCheckerEngine = new ClaimCheckerEngine();

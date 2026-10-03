import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { offers, auditLog } from "@/db/schema";
import { aiProvider } from "@/lib/providers/ai";

export interface OfferValidationResult {
  passedHardValidation: boolean;
  hardErrors: string[];
  aiReview?: unknown;
  finalStatus: "pending_review" | "rejected";
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  auditReason: string;
}

/**
 * Deterministic hard-rules validation.
 * AI can never bypass or override these rules.
 */
export function validateHardRules(offer: {
  title: string;
  description: string;
  priceAmount: number;
  includes: string[];
  originCity: string;
  destinationCity: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!offer.title || offer.title.trim().length < 5) {
    errors.push("عنوان العرض قصير جداً (٥ أحرف على الأقل).");
  }

  if (!offer.description || offer.description.trim().length < 20) {
    errors.push("وصف العرض غير كافٍ (٢٠ حرفاً على الأقل).");
  }

  if (!offer.priceAmount || offer.priceAmount <= 0) {
    errors.push("السعر يجب أن يكون أكبر من صفر.");
  }

  if (!offer.includes || offer.includes.length === 0) {
    errors.push("يجب إدراج خدمة واحدة على الأقل ضمن المشتملات.");
  }

  const phoneEmailPattern = /(\+?\d{8,15}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  if (phoneEmailPattern.test(offer.title) || phoneEmailPattern.test(offer.description)) {
    errors.push("يُحظر كتابة أرقام الهواتف أو البريد الإلكتروني في وصف العرض. التواصل يتم عبر البوابة الموثقة فقط.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Advisory AI review for a pending offer.
 * Human moderation remains the only path that can publish an offer.
 * Deterministic hard-rule violations may reject an offer automatically because
 * they are explicit policy failures, not probabilistic model judgments.
 */
export async function runAIOfferReviewPipeline(
  offerId: number,
): Promise<OfferValidationResult> {
  const rows = await db.select().from(offers).where(eq(offers.id, offerId)).limit(1);
  const offer = rows[0];

  if (!offer) throw new Error(`Offer ${offerId} not found`);
  if (offer.status !== "pending_review") {
    throw new Error(`Offer ${offerId} is not pending human review`);
  }

  const hardVal = validateHardRules({
    title: offer.title,
    description: offer.description,
    priceAmount: offer.priceAmount,
    includes: offer.includes,
    originCity: offer.originCity,
    destinationCity: offer.destinationCity,
  });

  if (!hardVal.valid) {
    const rejected = await db.transaction(async (tx) => {
      const updated = await tx
        .update(offers)
        .set({
          status: "rejected",
          rejectionReason: hardVal.errors.join(" | "),
        })
        .where(and(eq(offers.id, offerId), eq(offers.status, "pending_review")))
        .returning({ id: offers.id });

      if (updated.length === 0) return false;

      await tx.insert(auditLog).values({
        actor: "system_policy",
        action: "offer_rejected_hard_rule",
        targetType: "offer",
        targetId: offerId,
        reason: hardVal.errors.join(" | "),
        prevState: "pending_review",
        newState: "rejected",
      });
      return true;
    });

    if (!rejected) throw new Error(`Offer ${offerId} changed state during hard-rules review`);

    return {
      passedHardValidation: false,
      hardErrors: hardVal.errors,
      finalStatus: "rejected",
      riskLevel: "HIGH",
      auditReason: hardVal.errors.join(" | "),
    };
  }

  const aiResult = await aiProvider.reviewOffer({
    title: offer.title,
    description: offer.description,
    tripType: offer.tripType,
    priceAmount: offer.priceAmount,
    currency: offer.currency,
    priceType: offer.priceType,
    includes: offer.includes,
    excludes: offer.excludes,
    originCity: offer.originCity,
    destinationCity: offer.destinationCity,
    destinationCountry: offer.destinationCountry,
  });

  const auditAction =
    aiResult.riskLevel === "LOW" && aiResult.policyVerdict === "APPROVED"
      ? "offer_ai_review_low_risk"
      : aiResult.riskLevel === "MEDIUM"
        ? "offer_ai_review_medium_risk"
        : "offer_ai_review_high_risk";

  await db.insert(auditLog).values({
    actor: aiResult.reviewedBy,
    action: auditAction,
    targetType: "offer",
    targetId: offerId,
    reason: aiResult.reasoning.join(" | "),
    prevState: "pending_review",
    newState: "pending_review",
    meta: JSON.stringify({
      advisoryOnly: true,
      riskLevel: aiResult.riskLevel,
      transparencyScore: aiResult.transparencyScore,
      policyVerdict: aiResult.policyVerdict,
      reviewedBy: aiResult.reviewedBy,
    }),
  });

  return {
    passedHardValidation: true,
    hardErrors: [],
    aiReview: aiResult,
    finalStatus: "pending_review",
    riskLevel: aiResult.riskLevel,
    auditReason: aiResult.reasoning.join(" | "),
  };
}

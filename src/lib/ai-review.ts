import { eq } from "drizzle-orm";
import { db } from "@/db";
import { offers, auditLog } from "@/db/schema";
import type { Offer } from "@/db/schema";
import { aiProvider } from "@/lib/providers/ai";
import { notify } from "@/lib/notify";

export interface OfferValidationResult {
  passedHardValidation: boolean;
  hardErrors: string[];
  aiReview?: any;
  finalStatus: "published" | "pending_review" | "rejected";
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  auditReason: string;
}

/**
 * Deterministic Hard Rules validation.
 * AI cannot bypass these checks under any circumstance.
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

  // Check for prohibited direct contact info in copy
  const phoneEmailPattern = /(\+?\d{8,15}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  if (phoneEmailPattern.test(offer.title) || phoneEmailPattern.test(offer.description)) {
    errors.push("يُحظر كتابة أرقام الهواتف أو البريد الإلكتروني في وصف العرض. التواصل يتناول البوابة الموثقة فقط.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Executes the complete AI Offer Review & Risk Engine Pipeline.
 */
export async function runAIOfferReviewPipeline(
  offerId: number,
): Promise<OfferValidationResult> {
  const rows = await db.select().from(offers).where(eq(offers.id, offerId)).limit(1);
  const offer = rows[0];

  if (!offer) {
    throw new Error(`Offer ${offerId} not found`);
  }

  // Step 1: Hard Rules Check
  const hardVal = validateHardRules({
    title: offer.title,
    description: offer.description,
    priceAmount: offer.priceAmount,
    includes: offer.includes,
    originCity: offer.originCity,
    destinationCity: offer.destinationCity,
  });

  if (!hardVal.valid) {
    // Rejection due to hard rule violation
    await db
      .update(offers)
      .set({
        status: "rejected",
        rejectionReason: hardVal.errors.join(" | "),
      })
      .where(eq(offers.id, offerId));

    await db.insert(auditLog).values({
      actor: "system_policy",
      action: "offer_rejected_hard_rule",
      targetType: "offer",
      targetId: offerId,
      reason: hardVal.errors.join(" | "),
      prevState: offer.status,
      newState: "rejected",
    });

    return {
      passedHardValidation: false,
      hardErrors: hardVal.errors,
      finalStatus: "rejected",
      riskLevel: "HIGH",
      auditReason: hardVal.errors.join(" | "),
    };
  }

  // Step 2: AI Review for Transparency & Risk
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

  let finalStatus: "published" | "pending_review" | "rejected" = "pending_review";
  let auditAction = "offer_held_for_human_review";

  if (aiResult.riskLevel === "LOW" && aiResult.policyVerdict === "APPROVED") {
    finalStatus = "published";
    auditAction = "offer_auto_approved_low_risk";

    await db
      .update(offers)
      .set({
        status: "published",
        publishedAt: new Date(),
      })
      .where(eq(offers.id, offerId));
  } else if (aiResult.riskLevel === "MEDIUM") {
    finalStatus = "pending_review";
    auditAction = "offer_held_medium_risk";

    await db
      .update(offers)
      .set({
        status: "pending_review",
        rejectionReason: aiResult.reasoning.join(" | "),
      })
      .where(eq(offers.id, offerId));
  } else {
    finalStatus = "pending_review";
    auditAction = "offer_flagged_high_risk";

    await db
      .update(offers)
      .set({
        status: "pending_review",
        rejectionReason: `[تحذير مخاطر مرتفعة]: ${aiResult.reasoning.join(" | ")}`,
      })
      .where(eq(offers.id, offerId));
  }

  // Step 3: Record Audit Entry
  await db.insert(auditLog).values({
    actor: aiResult.reviewedBy,
    action: auditAction,
    targetType: "offer",
    targetId: offerId,
    reason: aiResult.reasoning.join(" | "),
    prevState: offer.status,
    newState: finalStatus,
    meta: JSON.stringify({
      riskLevel: aiResult.riskLevel,
      transparencyScore: aiResult.transparencyScore,
      reviewedBy: aiResult.reviewedBy,
    }),
  });

  return {
    passedHardValidation: true,
    hardErrors: [],
    aiReview: aiResult,
    finalStatus,
    riskLevel: aiResult.riskLevel,
    auditReason: aiResult.reasoning.join(" | "),
  };
}

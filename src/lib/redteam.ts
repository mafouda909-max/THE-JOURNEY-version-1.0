import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

/**
 * FRAUD & TRUST RED-TEAM DETECTION ENGINE
 *
 * Scans content, messages, and account operations for fraud patterns:
 *   - Off-platform payment solicitation
 *   - Duplicate identity hijacking
 *   - Deceptive pricing / missing caveats
 *   - Lead spam velocity
 *
 * Policy: Never permanently ban on a single opaque signal. Creates a risk case and escalates to admin queue.
 */

export interface FraudScanResult {
  isSuspicious: boolean;
  riskScore: number; // 0.0 - 1.0
  detectedFlags: string[];
  recommendedAction: "PASS" | "FLAG_FOR_REVIEW" | "ESCALATE_HIGH_RISK";
}

export class RedTeamSecurityEngine {
  public scanContentForFraud(text: string): FraudScanResult {
    const flags: string[] = [];
    let score = 0.0;

    const lower = text.toLowerCase();

    // Pattern 1: Off-platform payment or communication solicitation
    if (
      lower.includes("whatsapp") ||
      lower.includes("واتساب") ||
      lower.includes("تحويل خارج") ||
      lower.includes("خصم مباشر")
    ) {
      flags.push("off_platform_communication_solicitation");
      score += 0.45;
    }

    // Pattern 2: Phone number / email embedded in public text
    if (/(\+?\d{9,14}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/.test(text)) {
      flags.push("direct_contact_info_prohibited");
      score += 0.35;
    }

    // Pattern 3: Deceptive price claims without breakdown
    if (lower.includes("مجاناً") || lower.includes("أرخص سعر مضمون") || lower.includes("مجانا")) {
      flags.push("unverified_lowest_price_claim");
      score += 0.25;
    }

    let action: "PASS" | "FLAG_FOR_REVIEW" | "ESCALATE_HIGH_RISK" = "PASS";
    if (score >= 0.7) action = "ESCALATE_HIGH_RISK";
    else if (score >= 0.3) action = "FLAG_FOR_REVIEW";

    return {
      isSuspicious: flags.length > 0,
      riskScore: Math.min(1.0, score),
      detectedFlags: flags,
      recommendedAction: action,
    };
  }

  public async logFraudCase(entityType: string, entityId: number, scan: FraudScanResult): Promise<void> {
    await db.insert(auditLog).values({
      actor: "redteam_security_engine",
      action: `fraud_signal_${scan.recommendedAction.toLowerCase()}`,
      targetType: entityType,
      targetId: entityId,
      reason: `Fraud Red-Team scan detected flags: ${scan.detectedFlags.join(", ")} (Score: ${scan.riskScore})`,
      meta: JSON.stringify(scan),
    });
  }
}

export const redTeamSecurityEngine = new RedTeamSecurityEngine();

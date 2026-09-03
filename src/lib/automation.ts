import { eq, lt, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { offers, contactRequests, auditLog } from "@/db/schema";
import { runAIOfferReviewPipeline } from "@/lib/ai-review";
import { notify, accountIdForAgent } from "@/lib/notify";

/**
 * AUTOMATION OS ENGINE
 *
 * Implements the EVENT -> TRIGGER -> CONDITION -> RULE -> ACTION -> AUDIT pipeline.
 * Idempotent, retry-safe background tasks.
 */

export interface AutomationRunSummary {
  expiredOffersCount: number;
  slaEscalationsCount: number;
  autoReviewedOffersCount: number;
  timestamp: string;
}

export class AutomationEngine {
  /**
   * Run all background health & automation cron routines.
   */
  public async executeAutomationRoutines(): Promise<AutomationRunSummary> {
    const timestamp = new Date().toISOString();

    // Routine 1: Offer Expiry Check
    const expiredOffersCount = await this.expireOutdatedOffers();

    // Routine 2: Contact Lead SLA Escalation (>48h without response)
    const slaEscalationsCount = await this.escalateStaleLeads();

    // Routine 3: Process Pending Offers through AI Review Pipeline
    const autoReviewedOffersCount = await this.processPendingOffersQueue();

    return {
      expiredOffersCount,
      slaEscalationsCount,
      autoReviewedOffersCount,
      timestamp,
    };
  }

  /**
   * Automatically archive offers that have passed their expiration date.
   */
  private async expireOutdatedOffers(): Promise<number> {
    const now = new Date();
    const expiredRows = await db
      .select({ id: offers.id, agentId: offers.agentId })
      .from(offers)
      .where(and(eq(offers.status, "published"), lt(offers.expiresAt, now)));

    for (const offer of expiredRows) {
      await db
        .update(offers)
        .set({ status: "expired" })
        .where(eq(offers.id, offer.id));

      await db.insert(auditLog).values({
        actor: "system_automation",
        action: "offer_expired_auto",
        targetType: "offer",
        targetId: offer.id,
        reason: "Offer reached expiration date",
        prevState: "published",
        newState: "expired",
      });

      const accId = await accountIdForAgent(offer.agentId);
      if (accId) {
        await notify({
          accountId: accId,
          type: "offer_expired",
          title: "انتهت صلاحية العرض",
          body: `العرض رقم ${offer.id} انتهت مدة عرضه المحددة وتم أرشفته تلقائياً.`,
          targetId: offer.id,
        });
      }
    }

    return expiredRows.length;
  }

  /**
   * SLA Escalation: Check contact requests unanswered >48 hours.
   */
  private async escalateStaleLeads(): Promise<number> {
    const twoDaysAgo = new Date(Date.now() - 48 * 3600 * 1000);
    const staleLeads = await db
      .select({ id: contactRequests.id, agentId: contactRequests.agentId, offerId: contactRequests.offerId })
      .from(contactRequests)
      .where(
        and(
          eq(contactRequests.status, "new"),
          lt(contactRequests.createdAt, twoDaysAgo),
        ),
      );

    for (const lead of staleLeads) {
      await db.insert(auditLog).values({
        actor: "system_automation",
        action: "lead_sla_escalation",
        targetType: "contact_request",
        targetId: lead.id,
        reason: "Lead unresponded for over 48 hours",
      });

      const accId = await accountIdForAgent(lead.agentId);
      if (accId) {
        await notify({
          accountId: accId,
          type: "lead_sla_warning",
          title: "تنبيه استجابة: طلب تواصل متأخر",
          body: `طلب التواصل رقم ${lead.id} تجاوز ٤٨ ساعة بدون رد. يؤثر ذلك على تقييم نسبة استجابة الوكالة.`,
          targetId: lead.id,
        });
      }
    }

    return staleLeads.length;
  }

  /**
   * Run AI Review pipeline on pending offers.
   */
  private async processPendingOffersQueue(): Promise<number> {
    const pending = await db
      .select({ id: offers.id })
      .from(offers)
      .where(eq(offers.status, "pending_review"))
      .limit(5);

    let count = 0;
    for (const item of pending) {
      try {
        await runAIOfferReviewPipeline(item.id);
        count++;
      } catch {
        /* skip failing offer to avoid blocking queue */
      }
    }

    return count;
  }
}

export const automationEngine = new AutomationEngine();

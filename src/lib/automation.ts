import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { offers, contactRequests, auditLog } from "@/db/schema";
import { runAIOfferReviewPipeline } from "@/lib/ai-review";
import { notify, accountIdForAgent } from "@/lib/notify";

export interface AutomationRunSummary {
  expiredOffersCount: number;
  responseRemindersCount: number;
  aiAdvisoryReviewsCount: number;
  /** @deprecated Legacy metric alias. */
  slaEscalationsCount: number;
  /** @deprecated Legacy metric alias. AI never publishes offers. */
  autoReviewedOffersCount: number;
  timestamp: string;
}

export class AutomationEngine {
  public async executeAutomationRoutines(): Promise<AutomationRunSummary> {
    const timestamp = new Date().toISOString();
    const expiredOffersCount = await this.expireOutdatedOffers();
    const responseRemindersCount = await this.remindStaleLeads();
    const aiAdvisoryReviewsCount = await this.reviewPendingOffersAdvisory();

    return {
      expiredOffersCount,
      responseRemindersCount,
      aiAdvisoryReviewsCount,
      slaEscalationsCount: responseRemindersCount,
      autoReviewedOffersCount: aiAdvisoryReviewsCount,
      timestamp,
    };
  }

  private async expireOutdatedOffers(): Promise<number> {
    const now = new Date();
    const expiredRows = await db
      .select({ id: offers.id, agentId: offers.agentId })
      .from(offers)
      .where(and(eq(offers.status, "published"), lt(offers.expiresAt, now)));

    let expiredCount = 0;
    for (const offer of expiredRows) {
      const changed = await db.transaction(async (tx) => {
        const updated = await tx
          .update(offers)
          .set({ status: "expired" })
          .where(and(eq(offers.id, offer.id), eq(offers.status, "published")))
          .returning({ id: offers.id });

        if (updated.length === 0) return false;

        await tx.insert(auditLog).values({
          actor: "system_automation",
          action: "offer_expired_auto",
          targetType: "offer",
          targetId: offer.id,
          reason: "Offer reached its explicit expiration timestamp.",
          prevState: "published",
          newState: "expired",
        });
        return true;
      });

      if (!changed) continue;
      expiredCount += 1;

      const accountId = await accountIdForAgent(offer.agentId);
      if (accountId) {
        await notify({
          accountId,
          type: "offer_expired",
          title: "انتهت صلاحية العرض",
          body: `العرض رقم ${offer.id} وصل إلى تاريخ الانتهاء المحدد وتم إيقاف ظهوره تلقائيًا.`,
          targetId: offer.id,
        });
      }
    }

    return expiredCount;
  }

  private async remindStaleLeads(): Promise<number> {
    const twoDaysAgo = new Date(Date.now() - 48 * 3600 * 1000);
    const staleLeads = await db
      .select({ id: contactRequests.id, agentId: contactRequests.agentId })
      .from(contactRequests)
      .where(
        and(
          eq(contactRequests.status, "new"),
          lt(contactRequests.createdAt, twoDaysAgo),
        ),
      );

    let reminders = 0;
    for (const lead of staleLeads) {
      const accountId = await accountIdForAgent(lead.agentId);
      if (!accountId) continue;

      await notify({
        accountId,
        type: "response_reminder_48h",
        title: "طلب تواصل يحتاج متابعة",
        body: `طلب التواصل رقم ${lead.id} ما زال بحالة «جديد» بعد أكثر من ٤٨ ساعة. راجعه وحدّث حالته عند التواصل مع المسافر.`,
        targetId: lead.id,
      });
      reminders += 1;
    }

    return reminders;
  }

  /** AI produces advisory risk analysis only. Human moderation is the sole publish path. */
  private async reviewPendingOffersAdvisory(): Promise<number> {
    const pending = await db
      .select({ id: offers.id })
      .from(offers)
      .where(eq(offers.status, "pending_review"))
      .limit(5);

    let count = 0;
    for (const item of pending) {
      try {
        await runAIOfferReviewPipeline(item.id);
        count += 1;
      } catch {
        // One failed advisory review must not block the queue.
      }
    }

    return count;
  }
}

export const automationEngine = new AutomationEngine();

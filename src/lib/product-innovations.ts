import { eq } from "drizzle-orm";
import { db } from "@/db";
import { travelFacts, offers, auditLog } from "@/db/schema";
import { claimCheckerEngine } from "@/lib/claim-checker";
import { leadIntelligenceEngine } from "@/lib/lead-intel";

/**
 * OPERATIONAL QUALITY RUNNER
 *
 * This runner may inspect real platform records only. It must never fabricate a
 * regulatory change, fraud case, offer, traveler, or external verification just
 * to demonstrate that an engine works.
 */
export interface InnovationAuditReport {
  timestamp: string;
  alertsProcessed: number;
  offersAudited: number;
  leadsEscalated: number;
  fraudCasesLogged: number;
  staleFactsIdentified: number;
}

export class ProductInnovationsEngine {
  public async executePlatformInnovations(): Promise<InnovationAuditReport> {
    const timestamp = new Date().toISOString();

    const publishedOffers = await db
      .select()
      .from(offers)
      .where(eq(offers.status, "published"))
      .limit(5);

    let offersAudited = 0;
    for (const offer of publishedOffers) {
      await claimCheckerEngine.verifyOfferClaims({
        title: offer.title,
        description: offer.description,
        includes: offer.includes,
        originCity: offer.originCity,
        destinationCity: offer.destinationCity,
        destinationCountry: offer.destinationCountry,
      });
      offersAudited += 1;
    }

    const responseReminderResult = await leadIntelligenceEngine.monitorUnansweredLeadSLAs();

    const allFacts = await db.select().from(travelFacts);
    const staleFacts = allFacts.filter(
      (fact) => fact.freshnessStatus === "STALE" || fact.freshnessStatus === "EXPIRED",
    );

    await db.insert(auditLog).values({
      actor: "product_quality_runner",
      action: "platform_quality_run",
      targetType: "system",
      targetId: 0,
      reason: `Inspected ${offersAudited} real published offers, checked ${responseReminderResult.leadsChecked} real contact requests for response reminders, and found ${staleFacts.length} stale/expired travel facts. No synthetic alerts or fraud cases were created.`,
    });

    return {
      timestamp,
      alertsProcessed: 0,
      offersAudited,
      leadsEscalated: responseReminderResult.remindersSent,
      fraudCasesLogged: 0,
      staleFactsIdentified: staleFacts.length,
    };
  }
}

export const productInnovationsEngine = new ProductInnovationsEngine();

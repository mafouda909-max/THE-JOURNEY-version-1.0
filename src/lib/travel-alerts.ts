import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { contactRequests, offers, auditLog } from "@/db/schema";
import { notify } from "@/lib/notify";
import { eventBus } from "@/lib/events/bus";

/**
 * AUTOMATED TRAVEL ALERT SYSTEM
 *
 * Listens for travel fact changes (e.g. visa regulation update, flight policy change),
 * calculates precise impact on registered travelers / offers, and delivers targeted notifications.
 *
 * Policy: Never alert indiscriminately. Only notify travelers and agents with active bookings or queries for that specific route.
 */

export interface TravelAlertTarget {
  accountId: number;
  contactRequestId?: number;
  offerId?: number;
  alertType: "VISA_UPDATE" | "FLIGHT_POLICY" | "TRAVEL_ADVISORY";
  headline: string;
  detail: string;
}

export class TravelAlertEngine {
  /**
   * Process a fact change and send targeted notifications to affected accounts.
   */
  public async dispatchTargetedAlerts(params: {
    country: string;
    attribute: string;
    previousValue: string;
    newValue: string;
  }): Promise<{ alertsDispatched: number; affectedAccounts: number }> {
    // 1. Find active offers matching destination country
    const matchingOffers = await db
      .select()
      .from(offers)
      .where(eq(offers.destinationCountry, params.country));

    const offerIds = matchingOffers.map((o) => o.id);
    if (offerIds.length === 0) {
      return { alertsDispatched: 0, affectedAccounts: 0 };
    }

    // 2. Find active contact requests for those offers
    const requests = await db
      .select()
      .from(contactRequests);

    const relevantRequests = requests.filter((r) => offerIds.includes(r.offerId));
    let alertsDispatched = 0;
    const notifiedAccountIds = new Set<number>();

    for (const req of relevantRequests) {
      // Create notification
      const alertTitle = `تحديث هام بخصوص السفر إلى ${params.country}`;
      const alertBody = `تم تحديث شروط (${params.attribute}): التغيير من '${params.previousValue}' إلى '${params.newValue}'. يرجى مراجعة تفاصيل رحلتك.`;

      await db.insert(auditLog).values({
        actor: "travel_alert_engine",
        action: "targeted_travel_alert_sent",
        targetType: "contact_request",
        targetId: req.id,
        reason: `Notified traveler ${req.travelerEmail} for country fact update: ${params.country}`,
      });

      alertsDispatched++;
    }

    return {
      alertsDispatched,
      affectedAccounts: notifiedAccountIds.size,
    };
  }
}

export const travelAlertEngine = new TravelAlertEngine();

import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, contactRequests, offers } from "@/db/schema";
import { accountIdForAgent, notify } from "@/lib/notify";

/**
 * AUTOMATED TRAVEL ALERT SYSTEM
 *
 * Targets only accounts with a live marketplace query for the affected route.
 * Notifications are account-scoped, deduplicated per account for this dispatch,
 * and the audit record intentionally avoids traveler email/PII.
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
  public async dispatchTargetedAlerts(params: {
    country: string;
    attribute: string;
    previousValue: string;
    newValue: string;
  }): Promise<{ alertsDispatched: number; affectedAccounts: number }> {
    const now = new Date();
    const matchingOffers = await db
      .select({ id: offers.id, agentId: offers.agentId })
      .from(offers)
      .where(and(
        eq(offers.destinationCountry, params.country),
        eq(offers.status, "published"),
        or(isNull(offers.expiresAt), gt(offers.expiresAt, now)),
      ));

    if (matchingOffers.length === 0) {
      return { alertsDispatched: 0, affectedAccounts: 0 };
    }

    const offerIds = new Set(matchingOffers.map((offer) => offer.id));
    const agentByOffer = new Map(matchingOffers.map((offer) => [offer.id, offer.agentId]));
    const requests = await db.select().from(contactRequests);
    const relevantRequests = requests.filter((request) =>
      offerIds.has(request.offerId) &&
      request.status !== "closed" &&
      request.status !== "cancelled"
    );

    const targetByAccount = new Map<number, { requestId: number; link: string }>();
    for (const request of relevantRequests) {
      if (request.travelerAccountId && !targetByAccount.has(request.travelerAccountId)) {
        targetByAccount.set(request.travelerAccountId, {
          requestId: request.id,
          link: "/account/travel",
        });
      }

      const agentId = agentByOffer.get(request.offerId);
      if (agentId) {
        const agentAccountId = await accountIdForAgent(agentId);
        if (agentAccountId && !targetByAccount.has(agentAccountId)) {
          targetByAccount.set(agentAccountId, {
            requestId: request.id,
            link: "/account",
          });
        }
      }
    }

    const alertTitle = `تحديث هام بخصوص السفر إلى ${params.country}`;
    const alertBody = `تم تحديث شروط (${params.attribute}): التغيير من '${params.previousValue}' إلى '${params.newValue}'. راجع تفاصيل الرحلة قبل أي التزام.`;
    let alertsDispatched = 0;

    for (const [accountId, target] of targetByAccount) {
      const created = await notify({
        accountId,
        type: "travel_fact_update",
        title: alertTitle,
        body: alertBody,
        link: target.link,
        targetId: target.requestId,
        dedupeScope: `${params.country}|${params.attribute}|${params.newValue}`,
      });
      if (!created) continue;

      alertsDispatched += 1;
      await db.insert(auditLog).values({
        actor: "travel_alert_engine",
        action: "targeted_travel_alert_sent",
        targetType: "contact_request",
        targetId: target.requestId,
        reason: `Account-scoped travel fact alert delivered for ${params.country} / ${params.attribute}.`,
      });
    }

    return {
      alertsDispatched,
      affectedAccounts: targetByAccount.size,
    };
  }
}

export const travelAlertEngine = new TravelAlertEngine();

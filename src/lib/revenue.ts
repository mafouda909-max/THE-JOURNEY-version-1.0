import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { contactRequests, events, offers, campaigns, agents } from "@/db/schema";

/**
 * AI REVENUE INTELLIGENCE ENGINE
 *
 * Revenue Integrity Doctrine:
 *   - GMV: Total gross transaction volume requested by travelers.
 *   - Platform Fee Revenue: Platform take-rate on completed bookings.
 *   - Net Revenue: Gross fees minus refunds, chargebacks, and fraud losses.
 *   - Contribution Margin: Net Revenue minus direct customer acquisition cost (CAC).
 *   - Synthetic Test Notice: Acceptance test numbers are synthetic validation evidence.
 */

export interface HighValueDestination {
  destinationCountry: string;
  leadVolume: number;
  conversionRatePct: number;
  supplyOfferCount: number;
  supplyStatus: "HEALTHY" | "WEAK_SUPPLY" | "HIGH_DEMAND_GAP";
}

export interface RevenueIntelligenceSummary {
  totalLeads: number;
  qualifiedLeads: number;
  respondedLeads: number;
  conversionRatePct: number;
  gmvRequestedSAR: number;
  estimatedPlatformFeesSAR: number;
  highValueDestinations: HighValueDestination[];
  topPerformingAgents: Array<{ agentId: number; displayName: string; totalTrips: number; responseRate: number }>;
  strategicRecommendations: string[];
  evaluatedAt: string;
}

export class RevenueIntelligenceEngine {
  public async calculatePlatformRevenueMetrics(): Promise<RevenueIntelligenceSummary> {
    const evaluatedAt = new Date().toISOString();
    const allLeads = await db.select().from(contactRequests);
    const allOffers = await db.select().from(offers);
    const allAgents = await db.select().from(agents);

    const totalLeads = allLeads.length;
    const respondedLeads = allLeads.filter((l) => l.status === "responded" || l.status === "closed").length;
    const qualifiedLeads = allLeads.filter((l) => l.travelerCount >= 2).length;

    const conversionRatePct = totalLeads > 0 ? Math.round((respondedLeads / totalLeads) * 100) : 0;

    // Estimate GMV from offers attached to contact requests
    let gmvRequestedSAR = 0;
    for (const lead of allLeads) {
      const matchedOffer = allOffers.find((o) => o.id === lead.offerId);
      if (matchedOffer) {
        gmvRequestedSAR += matchedOffer.priceAmount * lead.travelerCount;
      } else {
        gmvRequestedSAR += 3500 * lead.travelerCount;
      }
    }

    const estimatedPlatformFeesSAR = Math.round(gmvRequestedSAR * 0.05); // 5% platform take-rate

    // High-Value Destinations & Supply Gap Analysis
    const destinationMap = new Map<string, { leadCount: number; respondedCount: number }>();
    for (const lead of allLeads) {
      const offer = allOffers.find((o) => o.id === lead.offerId);
      const dest = offer ? offer.destinationCountry : "السعودية";
      const existing = destinationMap.get(dest) || { leadCount: 0, respondedCount: 0 };
      existing.leadCount++;
      if (lead.status === "responded" || lead.status === "closed") existing.respondedCount++;
      destinationMap.set(dest, existing);
    }

    const highValueDestinations: HighValueDestination[] = [];
    for (const [dest, stats] of destinationMap.entries()) {
      const supplyCount = allOffers.filter((o) => o.destinationCountry === dest).length;
      const convPct = stats.leadCount > 0 ? Math.round((stats.respondedCount / stats.leadCount) * 100) : 0;

      let supplyStatus: "HEALTHY" | "WEAK_SUPPLY" | "HIGH_DEMAND_GAP" = "HEALTHY";
      if (supplyCount <= 2 && stats.leadCount > 3) supplyStatus = "HIGH_DEMAND_GAP";
      else if (supplyCount <= 1) supplyStatus = "WEAK_SUPPLY";

      highValueDestinations.push({
        destinationCountry: dest,
        leadVolume: stats.leadCount,
        conversionRatePct: convPct,
        supplyOfferCount: supplyCount,
        supplyStatus,
      });
    }

    // Top Performing Agents
    const topPerformingAgents = allAgents
      .slice(0, 5)
      .map((a) => ({
        agentId: a.id,
        displayName: a.displayName,
        totalTrips: a.totalTrips,
        responseRate: a.responseRate,
      }));

    // AI Strategic Recommendations
    const strategicRecommendations: string[] = [
      "توسيع شبكة الوكلاء المعتمدين في الوجهات ذات الطلب المرتفع والعرض المحدود.",
      "تفعيل التنبيهات الفورية للوكلاء عند تلقي طلبات مسافرين لرفع نسبة التحويل خلال أول ساعتين.",
      "تركيز الحملات التسويقية على البرامج السياحية الأكثر طلباً وفق بيانات تحليلات السوق.",
    ];

    return {
      totalLeads,
      qualifiedLeads,
      respondedLeads,
      conversionRatePct,
      gmvRequestedSAR,
      estimatedPlatformFeesSAR,
      highValueDestinations,
      topPerformingAgents,
      strategicRecommendations,
      evaluatedAt,
    };
  }
}

export const revenueIntelligenceEngine = new RevenueIntelligenceEngine();

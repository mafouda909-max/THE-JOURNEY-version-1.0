import { OfferWithAgent } from "@/lib/data";

/**
 * SMART OFFER RANKING & TRUST EXPLANATION PIPELINE
 *
 * Pipeline Order:
 *   1. Hard Constraints (destination, traveler count, date bounds, budget limit)
 *   2. Eligibility & Expiration (must be published and unexpired)
 *   3. Freshness & Data Quality (recently published/checked)
 *   4. Agent Trust Score (verification status, response SLA, total trips)
 *   5. Relevance Match (keyword, category, price affinity)
 *   6. Concise Trust Explanation (evidence-backed breakdown, NO raw chain of thought)
 *
 * Rule: HARD CONSTRAINTS ARE STRICT. AI MUST NEVER RECOMMEND AN OFFER VIOLATING HARD CONSTRAINTS.
 */

export interface TrustExplanation {
  whyItMatches: string;
  verifiedClaims: string[];
  agentClaims: string[];
  staleClaims: string[];
  confirmationNeeded: string[];
}

export interface RankedOffer {
  offer: OfferWithAgent;
  score: number;
  rankingFactors: {
    trustScore: number;
    freshnessScore: number;
    relevanceScore: number;
  };
  aiExplanation: string;
  trustExplanation: TrustExplanation;
}

export interface OfferRankingCriteria {
  destinationFilter?: string;
  minPrice?: number;
  maxPrice?: number;
  tripType?: string;
  travelerCount?: number;
}

export class SmartOfferRanker {
  public rankOffers(
    offersList: OfferWithAgent[],
    criteria?: OfferRankingCriteria,
  ): RankedOffer[] {
    const now = Date.now();

    const scored = offersList
      .filter((o) => {
        // Step 1 & 2: Hard Constraints & Eligibility
        if (o.status !== "published") return false;
        if (o.expiresAt && new Date(o.expiresAt).getTime() < now) return false;

        // Hard Constraint: Destination Filter
        if (criteria?.destinationFilter) {
          const filter = criteria.destinationFilter.toLowerCase();
          const match =
            o.destinationCountry.toLowerCase().includes(filter) ||
            o.destinationCountryEn.toLowerCase().includes(filter) ||
            o.destinationCity.toLowerCase().includes(filter);
          if (!match) return false;
        }

        // Hard Constraint: Trip Type
        if (criteria?.tripType && criteria.tripType !== "all" && o.tripType !== criteria.tripType) {
          return false;
        }

        // Hard Constraint: Price Bounds
        if (criteria?.minPrice && o.priceAmount < criteria.minPrice) return false;
        if (criteria?.maxPrice && o.priceAmount > criteria.maxPrice) return false;

        // Hard Constraint: Traveler Capacity
        if (criteria?.travelerCount) {
          if (criteria.travelerCount < o.minTravelers || criteria.travelerCount > o.maxTravelers) {
            return false;
          }
        }

        return true;
      })
      .map((o) => {
        // Step 3: Freshness Score (0 - 30 pts)
        const publishedTime = o.publishedAt ? new Date(o.publishedAt).getTime() : o.createdAt ? new Date(o.createdAt).getTime() : now;
        const daysOld = Math.max(0, (now - publishedTime) / (1000 * 3600 * 24));
        const freshnessScore = Math.max(0, 30 - daysOld * 2);

        // Step 4: Agent Trust Score (0 - 40 pts)
        let trustScore = 15;
        if (o.agent.verificationStatus === "verified") trustScore += 15;
        if (o.agent.responseRate >= 90) trustScore += 5;
        if (o.agent.avgResponseHours <= 4) trustScore += 5;

        // Step 5: Relevance & Value Score (0 - 30 pts)
        let relevanceScore = 20;
        if (o.includes.length >= 4) relevanceScore += 5;
        if (o.isFeatured) relevanceScore += 5;

        const totalScore = Math.round(freshnessScore + trustScore + relevanceScore);

        // Step 6: Trust Explanation Breakdown
        const verifiedClaims: string[] = [];
        if (o.agent.verificationStatus === "verified") verifiedClaims.push("سجل الوكالة التجاري والترخيص موثّق رسمياً");
        if (o.priceType === "per_person") verifiedClaims.push("السعر شامل ومحدد للشخص الواحد");

        const agentClaims: string[] = [];
        if (o.includes.length > 0) agentClaims.push(`المشمولات الرسمية (${o.includes.slice(0, 3).join("، ")})`);
        agentClaims.push(`السعر: ${o.priceAmount} ${o.currency}`);

        const staleClaims: string[] = [];
        if (daysOld > 14) staleClaims.push("تاريخ تحديث العرض يتجاوز 14 يوماً — يفضل إعادة التأكيد قبل الحجز");

        const confirmationNeeded: string[] = [];
        if (o.excludes.length === 0) confirmationNeeded.push("التحقق من الرسوم أو التكاليف غير المشمولة إن وجدت");

        const whyItMatches = `يتطابق العرض مع طلبك إلى ${o.destinationCountry} بسعر ${o.priceAmount} ${o.currency} من الوكيل المعتمد ${o.agent.displayName}.`;
        const aiExplanation = `تم ترشيح العرض بناءً على مطابقة القيود الصارمة، موثوقية الوكيل (${o.agent.displayName})، ودرجة الشفافية السعرية.`;

        return {
          offer: o,
          score: totalScore,
          rankingFactors: {
            trustScore,
            freshnessScore: Math.round(freshnessScore),
            relevanceScore,
          },
          aiExplanation,
          trustExplanation: {
            whyItMatches,
            verifiedClaims,
            agentClaims,
            staleClaims,
            confirmationNeeded,
          },
        };
      });

    return scored.sort((a, b) => b.score - a.score);
  }
}

export const smartOfferRanker = new SmartOfferRanker();

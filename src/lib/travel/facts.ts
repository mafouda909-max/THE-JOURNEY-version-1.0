import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { travelFacts, auditLog } from "@/db/schema";

/**
 * CANONICAL TRAVEL FACT STORE & SOURCE AUTHORITY HIERARCHY
 *
 * Source Authority Levels:
 *   5 = Official Government (.gov, embassy, ministry)
 *   4 = Official Airline / GDS / Supplier
 *   3 = Authoritative Industry Body (IATA, WTO)
 *   2 = Verified Platform Provider
 *   1 = Agent Reported (Unverified)
 *   0 = AI Inferred
 *
 * Doctrine: Never allow lower-authority information to silently overwrite higher-authority data.
 */

export type AuthorityLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface FactRecord {
  subject: string;
  attribute: string;
  value: string;
  source: string;
  sourceType: string;
  authorityLevel: AuthorityLevel;
  validUntil?: Date;
  externalReference?: string;
}

export const TTL_FRESHNESS_HOURS: Record<string, number> = {
  airport: 720, // 30 days
  airline: 336, // 14 days
  flight_price: 1, // 1 hour
  availability: 0.25, // 15 mins
  visa_requirement: 168, // 7 days
  travel_advisory: 24, // 24 hours
  agent_offer: 168, // 7 days
};

export class CanonicalFactStore {
  /**
   * Insert or update a travel fact, enforcing Source Authority Hierarchy.
   */
  public async upsertFact(fact: FactRecord): Promise<{ success: boolean; status: string }> {
    const existing = await db
      .select()
      .from(travelFacts)
      .where(
        and(
          eq(travelFacts.subject, fact.subject),
          eq(travelFacts.attribute, fact.attribute),
        ),
      )
      .limit(1);

    if (existing[0]) {
      const prev = existing[0];
      // Authority Conflict Check: Reject lower-authority overwrites
      if (fact.authorityLevel < prev.authorityLevel) {
        await db.insert(auditLog).values({
          actor: "travel_fact_store",
          action: "fact_update_rejected_lower_authority",
          targetType: "travel_fact",
          targetId: prev.id,
          reason: `Attempted overwrite by authority level ${fact.authorityLevel} over existing level ${prev.authorityLevel}`,
        });
        return {
          success: false,
          status: "REJECTED_LOWER_AUTHORITY",
        };
      }

      // Check if values conflict at same/higher authority
      let freshness: "FRESH" | "CONFLICTED" = "FRESH";
      if (fact.authorityLevel === prev.authorityLevel && fact.value !== prev.value) {
        freshness = "CONFLICTED";
      }

      await db
        .update(travelFacts)
        .set({
          value: fact.value,
          source: fact.source,
          sourceType: fact.sourceType,
          authorityLevel: fact.authorityLevel,
          checkedAt: new Date(),
          freshnessStatus: freshness,
          externalReference: fact.externalReference,
        })
        .where(eq(travelFacts.id, prev.id));

      return { success: true, status: freshness };
    }

    // Insert new fact
    const ttlHours = TTL_FRESHNESS_HOURS[fact.attribute] || 168;
    const validUntil = fact.validUntil || new Date(Date.now() + ttlHours * 3600 * 1000);

    await db.insert(travelFacts).values({
      subject: fact.subject,
      attribute: fact.attribute,
      value: fact.value,
      source: fact.source,
      sourceType: fact.sourceType,
      authorityLevel: fact.authorityLevel,
      freshnessStatus: "FRESH",
      validUntil,
      externalReference: fact.externalReference,
    });

    return { success: true, status: "FRESH" };
  }

  /**
   * Retrieve a travel fact and evaluate its freshness against TTL policy.
   */
  public async getFact(subject: string, attribute: string) {
    const rows = await db
      .select()
      .from(travelFacts)
      .where(and(eq(travelFacts.subject, subject), eq(travelFacts.attribute, attribute)))
      .limit(1);

    const fact = rows[0];
    if (!fact) return null;

    // Check expiration against validUntil
    const now = new Date();
    let currentFreshness = fact.freshnessStatus;
    if (fact.validUntil && fact.validUntil < now) {
      currentFreshness = "EXPIRED";
    }

    return {
      ...fact,
      freshnessStatus: currentFreshness,
    };
  }
}

export const canonicalFactStore = new CanonicalFactStore();

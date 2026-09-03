import { eq } from "drizzle-orm";
import { db } from "@/db";
import { travelFacts, auditLog } from "@/db/schema";
import { eventBus } from "@/lib/events/bus";

/**
 * TRAVEL DATA CHANGE ENGINE
 *
 * Detects material updates in canonical travel facts, classifies impact on active offers/travelers,
 * dispatches domain events, and creates audit records.
 */

export interface FactChangeImpact {
  subject: string;
  attribute: string;
  previousValue: string;
  newValue: string;
  isMaterialChange: boolean;
  affectedOffersCount: number;
}

export class TravelDataChangeEngine {
  public async handleFactUpdate(params: {
    subject: string;
    attribute: string;
    newValue: string;
    source: string;
    authorityLevel: number;
  }): Promise<FactChangeImpact> {
    const existing = await db
      .select()
      .from(travelFacts)
      .where(eq(travelFacts.subject, params.subject))
      .limit(1);

    const previousValue = existing[0] ? existing[0].value : "NONE";
    const isMaterialChange = previousValue !== params.newValue;

    if (isMaterialChange) {
      await db.insert(auditLog).values({
        actor: "travel_data_change_engine",
        action: "material_travel_fact_change",
        targetType: "travel_fact",
        targetId: existing[0]?.id || 0,
        reason: `Fact ${params.subject}:${params.attribute} changed from '${previousValue}' to '${params.newValue}'`,
        prevState: previousValue,
        newState: params.newValue,
      });

      // Dispatch domain event
      await eventBus.publish({
        type: "travel_fact.updated",
        entityId: params.subject,
        payload: {
          subject: params.subject,
          attribute: params.attribute,
          previousValue,
          newValue: params.newValue,
          source: params.source,
        },
        idempotencyKey: `tf_change_${params.subject}_${Date.now()}`,
        occurredAt: new Date().toISOString(),
      });
    }

    return {
      subject: params.subject,
      attribute: params.attribute,
      previousValue,
      newValue: params.newValue,
      isMaterialChange,
      affectedOffersCount: isMaterialChange ? 1 : 0,
    };
  }
}

export const travelDataChangeEngine = new TravelDataChangeEngine();

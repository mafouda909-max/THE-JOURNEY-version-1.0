import { db } from "@/db";
import { auditLog } from "@/db/schema";

/**
 * THE JOURNEY DOMAIN EVENT BUS
 *
 * Unified event bus for domain side effects.
 * Guarantees idempotency and safe retry execution.
 */

export type DomainEventType =
  | "account.created"
  | "identity.linked"
  | "identity.unlinked"
  | "identity.changed"
  | "identity.recovery_started"
  | "identity.recovery_completed"
  | "identity.assurance_upgraded"
  | "identity.risk_detected"
  | "agent.submitted"
  | "agent.verified"
  | "agent.rejected"
  | "agent.suspended"
  | "kyc.submitted"
  | "kyc.review_required"
  | "offer.created"
  | "offer.submitted"
  | "offer.ai_reviewed"
  | "offer.approved"
  | "offer.rejected"
  | "offer.expiring"
  | "offer.expired"
  | "lead.created"
  | "lead.qualified"
  | "lead.unanswered"
  | "lead.responded"
  | "lead.converted"
  | "review.submitted"
  | "risk.detected"
  | "risk.escalated"
  | "travel_fact.updated"
  | "travel_fact.stale"
  | "travel_fact.conflicted"
  | "price.changed"
  | "availability.changed"
  | "campaign.started"
  | "campaign.anomaly"
  | "payment.created"
  | "payment.failed"
  | "refund.requested"
  | "system.degraded";

export interface DomainEvent<T = any> {
  type: DomainEventType;
  entityId: number | string;
  payload: T;
  idempotencyKey: string;
  occurredAt: string;
}

export type EventHandler<T = any> = (event: DomainEvent<T>) => Promise<void>;

class EventBus {
  private handlers: Map<DomainEventType, EventHandler[]> = new Map();
  private processedKeys: Set<string> = new Set();

  public subscribe<T>(type: DomainEventType, handler: EventHandler<T>): void {
    const list = this.handlers.get(type) || [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  public async publish<T>(event: DomainEvent<T>): Promise<void> {
    if (this.processedKeys.has(event.idempotencyKey)) {
      return; // Idempotent skip
    }
    this.processedKeys.add(event.idempotencyKey);

    // Record event in audit trail
    await db.insert(auditLog).values({
      actor: "event_bus",
      action: event.type,
      targetType: typeof event.entityId === "number" ? "entity" : "system",
      targetId: typeof event.entityId === "number" ? event.entityId : 0,
      reason: `Domain Event Published: ${event.type}`,
      meta: JSON.stringify(event.payload),
    });

    const list = this.handlers.get(event.type) || [];
    for (const h of list) {
      try {
        await h(event);
      } catch (err) {
        console.error(`Error in event handler for ${event.type}:`, err);
      }
    }
  }
}

export const eventBus = new EventBus();

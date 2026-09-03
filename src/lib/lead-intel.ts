import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { contactRequests, agents, offers, auditLog } from "@/db/schema";
import { notify, accountIdForAgent } from "@/lib/notify";
import { eventBus } from "@/lib/events/bus";

/**
 * LEAD INTELLIGENCE ENGINE
 *
 * Operational Lead Lifecycle:
 *   new lead → qualification → trusted agent matching → assignment → notification → SLA reminder → escalation → outcome
 */

export interface LeadQualificationResult {
  leadId: number;
  isQualified: boolean;
  qualificationScore: number; // 0 - 100
  assignedAgentId: number;
  assignedAgentName: string;
  slaTargetHours: number;
  status: "QUALIFIED" | "NEEDS_INFO" | "UNQUALIFIED";
}

export class LeadIntelligenceEngine {
  /**
   * Qualify a new lead, match with top verified agent, assign SLA, and trigger notifications.
   */
  public async qualifyAndAssignLead(leadId: number): Promise<LeadQualificationResult> {
    const rows = await db
      .select()
      .from(contactRequests)
      .where(eq(contactRequests.id, leadId))
      .limit(1);

    const lead = rows[0];
    if (!lead) {
      throw new Error(`Lead ${leadId} not found.`);
    }

    // 1. Scoring & Qualification Rules
    let score = 50;
    if (lead.travelerCount >= 2) score += 20;
    if (lead.travelDates && lead.travelDates.length > 5) score += 15;
    if (lead.message && lead.message.length > 20) score += 15;

    const isQualified = score >= 60;
    const status = isQualified ? "QUALIFIED" : "NEEDS_INFO";

    // 2. Find Agent details
    const agentRows = await db
      .select()
      .from(agents)
      .where(eq(agents.id, lead.agentId))
      .limit(1);

    const agent = agentRows[0];
    const assignedAgentId = agent ? agent.id : lead.agentId;
    const assignedAgentName = agent ? agent.displayName : "وكالة سفر معتمدة";
    const slaTargetHours = agent ? Math.min(24, Math.max(2, Math.round(agent.avgResponseHours))) : 12;

    // 3. Record Qualification Audit Log
    await db.insert(auditLog).values({
      actor: "lead_intelligence_engine",
      action: "lead_qualified",
      targetType: "contact_request",
      targetId: leadId,
      reason: `Lead qualified with score ${score}/100. Matched with agent '${assignedAgentName}' (SLA: ${slaTargetHours}h)`,
    });

    // 4. Publish Event
    await eventBus.publish({
      type: "lead.qualified",
      entityId: leadId,
      payload: { leadId, score, agentId: assignedAgentId, slaTargetHours },
      idempotencyKey: `lead_qual_${leadId}_${Date.now()}`,
      occurredAt: new Date().toISOString(),
    });

    // 5. Agent Notification
    const agentAccId = await accountIdForAgent(assignedAgentId);
    if (agentAccId) {
      await notify({
        accountId: agentAccId,
        type: "new_lead_assignment",
        title: "طلب تواصل جديد من مسافر",
        body: `تلقيت طلب تواصل جديد من المسافر ${lead.travelerName} (${lead.travelerCount} مسافرين). المستهدف للرد: خلال ${slaTargetHours} ساعة.`,
        targetId: leadId,
      });
    }

    return {
      leadId,
      isQualified,
      qualificationScore: score,
      assignedAgentId,
      assignedAgentName,
      slaTargetHours,
      status,
    };
  }

  /**
   * Monitor SLA Reminders and Escalations for unanswered leads.
   */
  public async monitorUnansweredLeadSLAs(): Promise<{ leadsChecked: number; remindersSent: number }> {
    const leads = await db
      .select()
      .from(contactRequests)
      .where(eq(contactRequests.status, "new"));

    let remindersSent = 0;
    const now = Date.now();

    for (const lead of leads) {
      const ageHours = (now - new Date(lead.createdAt).getTime()) / 3_600_000;
      if (ageHours >= 6) {
        const agentAccId = await accountIdForAgent(lead.agentId);
        if (agentAccId) {
          await notify({
            accountId: agentAccId,
            type: "sla_reminder",
            title: "تذكير SLA: طلب تواصل في انتظار الرد",
            body: `طلب التواصل من ${lead.travelerName} ينتظر الرد منذ ${Math.round(ageHours)} ساعة.`,
            targetId: lead.id,
          });
          remindersSent++;
        }
      }
    }

    return {
      leadsChecked: leads.length,
      remindersSent,
    };
  }
}

export const leadIntelligenceEngine = new LeadIntelligenceEngine();

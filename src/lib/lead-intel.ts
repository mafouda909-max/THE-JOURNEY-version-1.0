import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contactRequests, agents, auditLog } from "@/db/schema";
import { notify, accountIdForAgent } from "@/lib/notify";
import { eventBus } from "@/lib/events/bus";

export interface LeadQualificationResult {
  leadId: number;
  isQualified: boolean;
  qualificationScore: number;
  assignedAgentId: number;
  assignedAgentName: string;
  responseTargetHours: number;
  /** @deprecated Legacy name retained for compatibility; this is not a contractual SLA. */
  slaTargetHours: number;
  status: "QUALIFIED" | "NEEDS_INFO" | "UNQUALIFIED";
}

export class LeadIntelligenceEngine {
  public async qualifyAndAssignLead(leadId: number): Promise<LeadQualificationResult> {
    const rows = await db
      .select()
      .from(contactRequests)
      .where(eq(contactRequests.id, leadId))
      .limit(1);

    const lead = rows[0];
    if (!lead) throw new Error(`Lead ${leadId} not found.`);

    let score = 50;
    if (lead.travelerCount >= 2) score += 20;
    if (lead.travelDates && lead.travelDates.length > 5) score += 15;
    if (lead.message && lead.message.length > 20) score += 15;

    const isQualified = score >= 60;
    const status = isQualified ? "QUALIFIED" : "NEEDS_INFO";

    const agentRows = await db
      .select()
      .from(agents)
      .where(eq(agents.id, lead.agentId))
      .limit(1);

    const agent = agentRows[0];
    const assignedAgentId = agent ? agent.id : lead.agentId;
    const assignedAgentName = agent ? agent.displayName : "وكالة السفر";
    const responseTargetHours = agent
      ? Math.min(24, Math.max(2, Math.round(agent.avgResponseHours)))
      : 12;

    await db.insert(auditLog).values({
      actor: "lead_intelligence_engine",
      action: "lead_qualified",
      targetType: "contact_request",
      targetId: leadId,
      reason: `Lead scored ${score}/100 and linked to agent '${assignedAgentName}'. Internal response reminder target: ${responseTargetHours}h; this is not a contractual SLA.`,
    });

    await eventBus.publish({
      type: "lead.qualified",
      entityId: leadId,
      payload: { leadId, score, agentId: assignedAgentId, responseTargetHours },
      idempotencyKey: `lead_qual_${leadId}_${Date.now()}`,
      occurredAt: new Date().toISOString(),
    });

    const agentAccId = await accountIdForAgent(assignedAgentId);
    if (agentAccId) {
      await notify({
        accountId: agentAccId,
        type: "new_lead_assignment",
        title: "طلب تواصل جديد من مسافر",
        body: `طلب جديد من ${lead.travelerName} (${lead.travelerCount} مسافرين). هدف المتابعة الداخلي: خلال نحو ${responseTargetHours} ساعة؛ هذا تذكير تشغيلي وليس وعدًا للمسافر.`,
        targetId: leadId,
      });
    }

    return {
      leadId,
      isQualified,
      qualificationScore: score,
      assignedAgentId,
      assignedAgentName,
      responseTargetHours,
      slaTargetHours: responseTargetHours,
      status,
    };
  }

  /** Legacy method name retained for compatibility. Sends operational response reminders only. */
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
            type: "response_reminder",
            title: "تذكير: طلب تواصل في انتظار الرد",
            body: `طلب التواصل من ${lead.travelerName} ينتظر المتابعة منذ ${Math.round(ageHours)} ساعة.`,
            targetId: lead.id,
          });
          remindersSent += 1;
        }
      }
    }

    return { leadsChecked: leads.length, remindersSent };
  }
}

export const leadIntelligenceEngine = new LeadIntelligenceEngine();

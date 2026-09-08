import { smsConfigured } from "@/lib/providers/sms";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, agents, agentDocuments } from "@/db/schema";

export async function agentEligibility(agentId: number) {
  const [row] = await db
    .select({ agent: agents, account: accounts })
    .from(agents)
    .innerJoin(accounts, eq(accounts.agentId, agents.id))
    .where(eq(agents.id, agentId))
    .limit(1);
  if (!row) return { eligible: false, reasons: ["ملف الوكيل غير مكتمل"] };
  const reasons: string[] = [];
  if (smsConfigured() && !row.account.phoneVerifiedAt)
    reasons.push("تحقق من هاتفك");
  if (!row.account.emailVerifiedAt) reasons.push("تحقق من بريدك الإلكتروني");
  if (row.agent.verificationStatus !== "verified" || !row.agent.verifiedAt)
    reasons.push("يلزم اعتماد فريق الثقة");
  const docs = await db
    .select()
    .from(agentDocuments)
    .where(
      and(
        eq(agentDocuments.agentId, agentId),
        eq(agentDocuments.status, "verified"),
        sql`${agentDocuments.verifiedAt} IS NOT NULL`,
        sql`(${agentDocuments.expiresAt} IS NULL OR ${agentDocuments.expiresAt} > now())`,
      ),
    );
  const valid = docs;
  if (!valid.some((d) => d.documentType === "passport_id"))
    reasons.push("يلزم مستند هوية معتمد");
  if (
    row.agent.licenseType === "agency" &&
    !valid.some(
      (d) =>
        d.documentType === "commercial_register" ||
        d.documentType === "license_cert",
    )
  )
    reasons.push("يلزم مستند ترخيص معتمد");
  return { eligible: reasons.length === 0, reasons };
}

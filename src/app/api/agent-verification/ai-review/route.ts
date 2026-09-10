import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { agents, agentDocuments, accounts, auditLog } from "@/db/schema";
import { accountFromRequest, requireAccount } from "@/lib/identity";
import { analyzeAgentDocuments, aiDocumentReviewConfigured, type AIVerificationResult } from "@/lib/ai-document-verification";
import { validDocumentEvidence } from "@/lib/document-evidence";
import { privateObjectInfo } from "@/lib/b2";

export const dynamic = "force-dynamic";

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agent_ai_verification_runs (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      status VARCHAR(16) NOT NULL DEFAULT 'completed',
      overall_confidence REAL,
      risk_level VARCHAR(16),
      recommendation VARCHAR(16),
      result_json TEXT,
      model VARCHAR(80),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS agent_ai_verification_runs_agent_idx ON agent_ai_verification_runs(agent_id, created_at DESC)`);
}

export async function POST(request: Request) {
  const account = await accountFromRequest(request);
  const denied = requireAccount(account, ["agent", "admin"]);
  if (denied) return denied;
  if (!account) return NextResponse.json({ error: "غير مصرح." }, { status: 401 });

  let requestedAgentId: number | null = account.agentId;
  if (account.role === "admin") {
    try {
      const body = (await request.json()) as { agentId?: unknown };
      requestedAgentId = typeof body.agentId === "number" ? body.agentId : Number(body.agentId);
    } catch {
      return NextResponse.json({ error: "agentId مطلوب للمراجعة الإدارية." }, { status: 400 });
    }
  }
  if (requestedAgentId === null || !Number.isInteger(requestedAgentId) || requestedAgentId <= 0) {
    return NextResponse.json({ error: "agentId غير صالح." }, { status: 400 });
  }
  const agentId = requestedAgentId;

  if (!aiDocumentReviewConfigured()) {
    return NextResponse.json({ error: "مراجعة المستندات بالذكاء الاصطناعي غير مفعلة حاليًا." }, { status: 503 });
  }

  const agentsRows = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  const agent = agentsRows[0];
  if (!agent) return NextResponse.json({ error: "ملف الوكيل غير موجود." }, { status: 404 });
  if (agent.verificationStatus === "verified") {
    return NextResponse.json({ error: "ملف الوكيل موثّق بالفعل؛ أي إعادة تحليل يجب أن تتم من فريق الثقة." }, { status: 409 });
  }

  const docs = await db
    .select({ id: agentDocuments.id, documentType: agentDocuments.documentType, originalName: agentDocuments.originalName, storageKey: agentDocuments.storageKey, status: agentDocuments.status, expiresAt: agentDocuments.expiresAt })
    .from(agentDocuments)
    .where(eq(agentDocuments.agentId, agent.id));

  const required = agent.licenseType === "agency" ? ["identity", "license", "commercial_register"] : ["identity", "license"];
  const selected = docs.filter((doc) => (doc.status === "pending" || doc.status === "verified") && required.includes(doc.documentType));
  const missing: string[] = [];
  const validDocs: typeof selected = [];
  for (const type of required) {
    const candidates = selected.filter((doc) => doc.documentType === type);
    let exists = false;
    for (const doc of candidates) {
      if (validDocumentEvidence(agent.id, doc, await privateObjectInfo(doc.storageKey))) {
        validDocs.push(doc);
        exists = true;
        break;
      }
    }
    if (!exists) missing.push(type);
  }
  if (missing.length) {
    return NextResponse.json({ error: `أكمل أدلة التوثيق المطلوبة أولًا: ${missing.join("، ")}.` }, { status: 422 });
  }

  const [accountRow] = await db.select({ email: accounts.email }).from(accounts).where(eq(accounts.id, account.id)).limit(1);

  let result: AIVerificationResult;
  try {
    result = await analyzeAgentDocuments(
      {
        displayName: agent.displayName,
        latinName: agent.latinName,
        city: agent.city,
        country: agent.country,
        licenseType: agent.licenseType,
        licenseNumber: agent.licenseNumber,
        email: accountRow?.email ?? "",
      },
      validDocs,
    );
  } catch (error) {
    await ensureTable();
    await db.execute(sql`
      INSERT INTO agent_ai_verification_runs (agent_id, status, result_json, model)
      VALUES (${agent.id}, 'failed', ${JSON.stringify({ error: error instanceof Error ? error.message : "AI verification failed" })}, ${process.env.OPENAI_DOCUMENT_REVIEW_MODEL || "gpt-5.6-luna"})
    `);
    return NextResponse.json({ error: "تعذر إكمال تحليل المستندات آليًا. سيظل قرار التوثيق بيد فريق الثقة." }, { status: 502 });
  }

  await ensureTable();
  await db.execute(sql`
    INSERT INTO agent_ai_verification_runs
      (agent_id, status, overall_confidence, risk_level, recommendation, result_json, model)
    VALUES
      (${agent.id}, 'completed', ${result.overallConfidence}, ${result.riskLevel}, ${result.recommendation}, ${JSON.stringify(result)}, ${process.env.OPENAI_DOCUMENT_REVIEW_MODEL || "gpt-5.6-luna"})
  `);

  await db.insert(auditLog).values({
    actor: account.role,
    action: "agent_ai_verification_requested",
    targetType: "agent",
    targetId: agent.id,
    reason: `AI evidence analysis completed: ${result.recommendation}/${result.riskLevel}/${result.overallConfidence}`,
    meta: JSON.stringify({ confidence: result.overallConfidence, risk: result.riskLevel, recommendation: result.recommendation }),
  });

  return NextResponse.json({ ok: true, result, humanReviewRequired: true });
}

export async function GET(request: Request) {
  const account = await accountFromRequest(request);
  const denied = requireAccount(account, ["agent", "admin"]);
  if (denied) return denied;
  if (!account) return NextResponse.json({ error: "غير مصرح." }, { status: 401 });
  if (!account.agentId && account.role !== "admin") return NextResponse.json({ error: "الحساب غير مرتبط بملف وكيل." }, { status: 409 });

  const requestedAgentId = new URL(request.url).searchParams.get("agentId");
  const agentId: number | null = account.role === "admin"
    ? Number(requestedAgentId)
    : account.agentId;
  if (agentId === null || !Number.isInteger(agentId) || agentId <= 0) {
    return NextResponse.json({ error: "agentId غير صالح." }, { status: 400 });
  }

  await ensureTable();
  const result = await db.execute(sql`
    SELECT id, agent_id AS "agentId", status, overall_confidence AS "overallConfidence", risk_level AS "riskLevel", recommendation, result_json AS "resultJson", model, created_at AS "createdAt"
    FROM agent_ai_verification_runs
    WHERE agent_id = ${agentId}
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return NextResponse.json({ run: null });
  return NextResponse.json({ run: { ...row, result: row.resultJson ? JSON.parse(String(row.resultJson)) : null } });
}

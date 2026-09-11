import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { agents, agentDocuments, accounts, auditLog } from "@/db/schema";
import { accountFromRequest } from "@/lib/identity";
import { requireAdmin } from "@/lib/auth";
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

async function resolveActor(request: Request, requestedAgentId: unknown) {
  const account = await accountFromRequest(request);
  if (account?.role === "agent" && account.agentId) {
    return { kind: "agent" as const, agentId: account.agentId, accountId: account.id };
  }

  const denied = requireAdmin(request);
  if (denied) return { denied } as const;
  const agentId = Number(requestedAgentId);
  if (!Number.isInteger(agentId) || agentId <= 0) {
    return { denied: NextResponse.json({ error: "agentId غير صالح." }, { status: 400 }) } as const;
  }
  return { kind: "admin" as const, agentId, accountId: null };
}

export async function POST(request: Request) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Agent self-review does not require a body; admin review does.
  }
  const requestedAgentId = (body as Record<string, unknown> | null)?.agentId;
  const actor = await resolveActor(request, requestedAgentId);
  if ("denied" in actor) return actor.denied;
  const agentId = actor.agentId;

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

  const [ownerAccount] = await db
    .select({ email: accounts.email })
    .from(accounts)
    .where(eq(accounts.agentId, agent.id))
    .limit(1);

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
        email: ownerAccount?.email ?? "",
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
    actor: actor.kind,
    action: "agent_ai_verification_requested",
    targetType: "agent",
    targetId: agent.id,
    reason: `AI evidence analysis completed: ${result.recommendation}/${result.riskLevel}/${result.overallConfidence}`,
    meta: JSON.stringify({ confidence: result.overallConfidence, risk: result.riskLevel, recommendation: result.recommendation }),
  });

  return NextResponse.json({ ok: true, result, humanReviewRequired: true });
}

export async function GET(request: Request) {
  const requestedAgentId = new URL(request.url).searchParams.get("agentId");
  const actor = await resolveActor(request, requestedAgentId);
  if ("denied" in actor) return actor.denied;

  await ensureTable();
  const result = await db.execute(sql`
    SELECT id, agent_id AS "agentId", status, overall_confidence AS "overallConfidence", risk_level AS "riskLevel", recommendation, result_json AS "resultJson", model, created_at AS "createdAt"
    FROM agent_ai_verification_runs
    WHERE agent_id = ${actor.agentId}
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return NextResponse.json({ run: null });
  return NextResponse.json({ run: { ...row, result: row.resultJson ? JSON.parse(String(row.resultJson)) : null } });
}

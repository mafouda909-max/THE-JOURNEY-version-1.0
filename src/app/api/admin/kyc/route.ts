import { NextResponse } from "next/server";
import { pool } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { agentKYCService } from "@/lib/kyc";
import { inspectPrivateObject } from "@/lib/r2";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const id = Number(new URL(request.url).searchParams.get("agentId"));
  if (!Number.isSafeInteger(id) || id < 1)
    return NextResponse.json({ error: "Invalid agent" }, { status: 422 });
  try {
    const documents = await agentKYCService.getAgentDocumentsWithAccess(
      id,
      request,
    );
    const audit = await pool.query(
      "SELECT actor,action,reason,prev_state,new_state,created_at FROM audit_log WHERE target_type='agent' AND target_id=$1 ORDER BY created_at DESC LIMIT 40",
      [id],
    );
    const account = await pool.query(
      "SELECT email_verified_at,phone_verified_at FROM accounts WHERE agent_id=$1",
      [id],
    );
    return NextResponse.json(
      { documents, audit: audit.rows, assurance: account.rows[0] ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "تعذر فتح المستندات. تحقق من إعداد التخزين." },
      { status: 503 },
    );
  }
}
export async function PATCH(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    !b ||
    !Number.isSafeInteger(b.id) ||
    !["verified", "rejected"].includes(String(b.decision)) ||
    typeof b.reason !== "string" ||
    b.reason.trim().length < 10
  )
    return NextResponse.json(
      { error: "Document, decision and review reason required" },
      { status: 422 },
    );
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const { rows } = await c.query(
      "SELECT d.*,a.verification_status FROM agent_documents d JOIN agents a ON a.id=d.agent_id WHERE d.id=$1 FOR UPDATE OF a,d",
      [b.id],
    );
    const d = rows[0];
    if (!d || d.verification_status !== "in_review" || d.status !== "pending") {
      await c.query("ROLLBACK");
      return NextResponse.json(
        { error: "Document not pending review" },
        { status: 409 },
      );
    }
    if (b.decision === "verified") await inspectPrivateObject(d.storage_key);
    await c.query(
      "UPDATE agent_documents SET status=$2::text,verified_at=CASE WHEN $2::text='verified' THEN now() ELSE NULL END,rejection_reason=CASE WHEN $2::text='rejected' THEN $3 ELSE NULL END WHERE id=$1",
      [b.id, b.decision, b.reason.trim()],
    );
    await c.query(
      "INSERT INTO audit_log(actor,action,target_type,target_id,reason,prev_state,new_state,meta) VALUES('admin','kyc_document_review','agent',$1,$2,'pending',$3,$4)",
      [
        d.agent_id,
        b.reason.trim(),
        b.decision,
        JSON.stringify({ documentId: d.id }),
      ],
    );
    await c.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch {
    await c.query("ROLLBACK");
    return NextResponse.json(
      { error: "Document review failed" },
      { status: 422 },
    );
  } finally {
    c.release();
  }
}

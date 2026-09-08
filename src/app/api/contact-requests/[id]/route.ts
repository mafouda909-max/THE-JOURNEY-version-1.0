import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { pool } from "@/db";
import { accountFromRequest } from "@/lib/identity";
import { canTransitionContact } from "@/lib/contact-state";
export const dynamic = "force-dynamic";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await accountFromRequest(request);
  if (!a) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Number.isSafeInteger(id) || id < 1 || !b || typeof b.status !== "string")
    return NextResponse.json({ error: "Invalid request" }, { status: 422 });
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const { rows } = await c.query(
      "SELECT * FROM contact_requests WHERE id=$1 FOR UPDATE",
      [id],
    );
    const lead = rows[0];
    const owner = lead && a.role === "agent" && lead.agent_id === a.agentId;
    const traveler = lead && lead.traveler_account_id === a.id;
    if (!lead || (!owner && !traveler)) {
      await c.query("ROLLBACK");
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (
      (traveler && !owner && b.status !== "cancelled") ||
      (owner && b.status === "cancelled") ||
      !canTransitionContact(lead.status, b.status)
    ) {
      await c.query("ROLLBACK");
      return NextResponse.json(
        { error: "Invalid transition" },
        { status: 409 },
      );
    }
    if (
      b.status === "responded" &&
      (typeof b.response !== "string" ||
        b.response.trim().length < 10 ||
        b.response.length > 3000)
    ) {
      await c.query("ROLLBACK");
      return NextResponse.json(
        { error: "اكتب ردًا من ١٠ إلى ٣٠٠٠ حرف" },
        { status: 422 },
      );
    }
    await c.query(
      "UPDATE contact_requests SET status=$2::text,response=CASE WHEN $2::text='responded' THEN $3 ELSE response END,responded_at=CASE WHEN $2::text='responded' THEN now() ELSE responded_at END WHERE id=$1",
      [id, b.status, typeof b.response === "string" ? b.response.trim() : null],
    );
    await c.query(
      "INSERT INTO audit_log(actor,action,target_type,target_id,prev_state,new_state) VALUES($1,'contact_status_changed','contact_request',$2,$3,$4)",
      [`account:${a.id}`, id, lead.status, b.status],
    );
    if (b.status === "responded" && lead.traveler_account_id)
      await c.query(
        "INSERT INTO notifications(account_id,type,title,body,link,idempotency_key) VALUES($1,'contact_responded','وصل رد الوكيل','يمكنك قراءة الرد من حسابك','/account',$2) ON CONFLICT (idempotency_key) DO NOTHING",
        [
          lead.traveler_account_id,
          `response:${id}:${lead.traveler_account_id}`,
        ],
      );
    await c.query("COMMIT");
    return NextResponse.json({ ok: true, status: b.status });
  } catch {
    await c.query("ROLLBACK");
    return NextResponse.json({ error: "تعذر تحديث الطلب" }, { status: 503 });
  } finally {
    c.release();
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await accountFromRequest(request);
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  const hash = token ? createHash("sha256").update(token).digest("hex") : null;
  const { rows } = await pool.query(
    "SELECT status,response,created_at,responded_at FROM contact_requests WHERE id=$1 AND (($2::int IS NOT NULL AND traveler_account_id=$2) OR ($3::int IS NOT NULL AND agent_id=$3) OR ($4::text IS NOT NULL AND tracking_token_hash=$4))",
    [id, a?.id ?? null, a?.role === "agent" ? a.agentId : null, hash],
  );
  if (!rows[0])
    return NextResponse.json(
      { error: "الطلب غير متاح بهذا الرابط أو الحساب" },
      { status: 404 },
    );
  return NextResponse.json(
    { request: rows[0] },
    { headers: { "Cache-Control": "no-store" } },
  );
}

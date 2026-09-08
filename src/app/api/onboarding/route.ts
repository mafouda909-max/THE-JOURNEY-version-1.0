import { smsConfigured } from "@/lib/providers/sms";
import { NextResponse } from "next/server";
import { pool } from "@/db";
import { accountFromRequest } from "@/lib/identity";
import { agentEligibility } from "@/lib/eligibility";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const a = await accountFromRequest(request);
  if (!a) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    emailVerified: Boolean(a.emailVerifiedAt),
    phoneVerified: Boolean(a.phoneVerifiedAt),
    phoneConfigured: smsConfigured(),
    eligibility: a.agentId ? await agentEligibility(a.agentId) : null,
  });
}
export async function POST(request: Request) {
  const a = await accountFromRequest(request);
  if (!a || a.role !== "agent" || !a.agentId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!b) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const { rows } = await c.query(
      "SELECT * FROM agents WHERE id=$1 FOR UPDATE",
      [a.agentId],
    );
    if (!["pending", "rejected"].includes(rows[0]?.verification_status)) {
      await c.query("ROLLBACK");
      return NextResponse.json(
        { error: "الملف قيد المراجعة أو معتمد" },
        { status: 409 },
      );
    }
    if (b.action === "submit") {
      const docs = await c.query(
        "SELECT document_type FROM agent_documents WHERE agent_id=$1 AND status IN ('pending','verified')",
        [a.agentId],
      );
      if (
        !a.emailVerifiedAt ||
        (smsConfigured() && !a.phoneVerifiedAt) ||
        rows[0].bio.length < 30 ||
        !docs.rows.some((d) => d.document_type === "passport_id") ||
        (rows[0].license_type === "agency" &&
          !docs.rows.some((d) =>
            ["commercial_register", "license_cert"].includes(d.document_type),
          ))
      ) {
        await c.query("ROLLBACK");
        return NextResponse.json(
          {
            error:
              "أكمل بياناتك وتحقق من البريد وأرفق مستند الهوية والترخيص عند الحاجة",
          },
          { status: 422 },
        );
      }
      await c.query(
        "UPDATE agents SET verification_status='in_review',verified_at=NULL WHERE id=$1",
        [a.agentId],
      );
      await c.query(
        "INSERT INTO audit_log(actor,action,target_type,target_id,prev_state,new_state) VALUES($1,'kyc_submitted','agent',$2,$3,'in_review')",
        [`account:${a.id}`, a.agentId, rows[0].verification_status],
      );
    } else if (b.action === "profile") {
      if (
        typeof b.bio !== "string" ||
        b.bio.trim().length < 30 ||
        typeof b.city !== "string" ||
        !b.city.trim() ||
        typeof b.country !== "string" ||
        !b.country.trim() ||
        !["individual", "agency"].includes(String(b.licenseType))
      ) {
        await c.query("ROLLBACK");
        return NextResponse.json(
          { error: "أدخل نبذة من ٣٠ حرفًا والمدينة والدولة ونوع الترخيص" },
          { status: 422 },
        );
      }
      await c.query(
        "UPDATE agents SET bio=$2,city=$3,country=$4,license_type=$5,license_number=$6 WHERE id=$1",
        [
          a.agentId,
          b.bio.trim().slice(0, 2000),
          b.city.trim().slice(0, 60),
          b.country.trim().slice(0, 60),
          b.licenseType,
          typeof b.licenseNumber === "string"
            ? b.licenseNumber.slice(0, 40)
            : null,
        ],
      );
    } else {
      await c.query("ROLLBACK");
      return NextResponse.json({ error: "Invalid action" }, { status: 422 });
    }
    await c.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch {
    await c.query("ROLLBACK");
    return NextResponse.json({ error: "تعذر حفظ الملف" }, { status: 503 });
  } finally {
    c.release();
  }
}

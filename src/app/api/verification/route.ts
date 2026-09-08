import { smsConfigured, sendVerificationSms } from "@/lib/providers/sms";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { pool } from "@/db";
import { accountFromRequest } from "@/lib/identity";
import { emailProvider } from "@/lib/providers/email";
import {
  newVerificationCode,
  verificationHash,
  matchesVerification,
} from "@/lib/verification-secret";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const account = await accountFromRequest(request);
  if (!account)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!input || (input.channel !== "email" && input.channel !== "phone"))
    return NextResponse.json({ error: "Invalid channel" }, { status: 422 });
  if (input.channel === "phone" && !smsConfigured())
    return NextResponse.json(
      {
        error: "خدمة التحقق من الهاتف غير مهيأة بعد.",
        code: "PROVIDER_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  if (input.action === "request") {
    if (input.channel === "email" && !emailProvider.isConfigured())
      return NextResponse.json(
        {
          error: "خدمة إرسال البريد غير مهيأة.",
          code: "PROVIDER_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    const destination =
      input.channel === "email" ? account.email : String(input.phone ?? "");
    if (input.channel === "phone" && !/^\+[1-9]\d{7,14}$/.test(destination))
      return NextResponse.json(
        { error: "أدخل رقم هاتف بصيغة دولية" },
        { status: 422 },
      );
    const client = await pool.connect();
    const id = randomUUID();
    const code = newVerificationCode();
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM accounts WHERE id=$1 FOR UPDATE", [
        account.id,
      ]);
      const recent = await client.query(
        "SELECT count(*)::int AS n FROM verification_challenges WHERE account_id=$1 AND created_at > now() - interval '1 hour'",
        [account.id],
      );
      if (recent.rows[0].n >= 5) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "محاولات كثيرة. حاول لاحقًا." },
          { status: 429 },
        );
      }
      await client.query(
        "UPDATE verification_challenges SET consumed_at=now() WHERE account_id=$1 AND channel=$2 AND consumed_at IS NULL",
        [account.id, input.channel],
      );
      await client.query(
        "INSERT INTO verification_challenges(id,account_id,channel,destination,secret_hash,expires_at) VALUES($1,$2,$5,$3,$4,now()+interval '10 minutes')",
        [
          id,
          account.id,
          destination,
          verificationHash(id, code),
          input.channel,
        ],
      );
      await client.query("COMMIT");
    } catch {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "تعذر إنشاء التحقق" }, { status: 503 });
    } finally {
      client.release();
    }
    const sent =
      input.channel === "phone"
        ? await sendVerificationSms(destination, code)
        : await emailProvider.sendEmail({
            to: account.email,
            subject: "رمز التحقق — الرحلة",
            html: `<p>رمز التحقق: <strong>${code}</strong></p><p>صالح لعشر دقائق.</p>`,
          });
    if (!sent.sent) {
      await pool.query(
        "UPDATE verification_challenges SET consumed_at=now() WHERE id=$1",
        [id],
      );
      return NextResponse.json(
        { error: "تعذر إرسال رمز التحقق. حاول لاحقًا." },
        { status: 503 },
      );
    }
    return NextResponse.json({ status: "sent" });
  }
  if (
    input.action !== "confirm" ||
    typeof input.code !== "string" ||
    !/^\d{6}$/.test(input.code)
  )
    return NextResponse.json(
      { error: "أدخل رمزًا من ستة أرقام" },
      { status: 422 },
    );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "SELECT * FROM verification_challenges WHERE account_id=$1 AND channel=$2 AND consumed_at IS NULL AND expires_at > now() AND attempts < 5 ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
      [account.id, input.channel],
    );
    const challenge = result.rows[0];
    if (!challenge) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "الرمز غير صالح أو منتهي" },
        { status: 422 },
      );
    }
    await client.query(
      "UPDATE verification_challenges SET attempts=attempts+1 WHERE id=$1",
      [challenge.id],
    );
    if (
      !matchesVerification(challenge.id, input.code, challenge.secret_hash) ||
      (input.channel === "email" && challenge.destination !== account.email)
    ) {
      await client.query("COMMIT");
      return NextResponse.json(
        { error: "الرمز غير صالح أو منتهي" },
        { status: 422 },
      );
    }
    await client.query(
      "UPDATE verification_challenges SET consumed_at=now() WHERE id=$1",
      [challenge.id],
    );
    if (input.channel === "email")
      await client.query(
        "UPDATE accounts SET email_verified_at=now() WHERE id=$1 AND email=$2",
        [account.id, challenge.destination],
      );
    else
      await client.query(
        "UPDATE accounts SET phone=$2,phone_verified_at=now() WHERE id=$1",
        [account.id, challenge.destination],
      );
    await client.query(
      "INSERT INTO audit_log(actor,action,target_type,target_id,new_state) VALUES($1,$3,'account',$2,'verified')",
      [`account:${account.id}`, account.id, `${input.channel}_verified`],
    );
    await client.query("COMMIT");
    return NextResponse.json({ status: "verified" });
  } catch {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: "تعذر التحقق" }, { status: 503 });
  } finally {
    client.release();
  }
}

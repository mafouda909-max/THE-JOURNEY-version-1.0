import { NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

export const dynamic = "force-dynamic";

type ResendEvent = {
  type?: string;
  data?: { email_id?: string };
};

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Webhook verification is not configured" }, { status: 503 });
  }

  const payload = await request.text();
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY || "re_webhook_verification_only");
    const event = await Promise.resolve(resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret: secret,
    })) as ResendEvent;

    const type = typeof event.type === "string" ? event.type.slice(0, 48) : "email.unknown";
    const emailId = typeof event.data?.email_id === "string" ? event.data.email_id.slice(0, 120) : null;

    await db.insert(auditLog).values({
      actor: "system",
      action: "email_delivery_event",
      targetType: "email",
      targetId: 0,
      reason: null,
      prevState: null,
      newState: type.replace(/^email\./, "").slice(0, 24),
      meta: emailId ? `resend_email_id:${emailId}` : null,
    });

    if (type === "email.failed" || type === "email.bounced" || type === "email.suppressed") {
      console.error("[email] delivery failure", { type, emailId });
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }
}

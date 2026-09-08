/** Twilio Messaging API: https://www.twilio.com/docs/messaging/api/message-resource */
export function smsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER,
  );
}
export async function sendVerificationSms(
  to: string,
  code: string,
): Promise<{ sent: boolean }> {
  if (!smsConfigured() || !/^\+[1-9]\d{7,14}$/.test(to)) return { sent: false };
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: process.env.TWILIO_FROM_NUMBER!,
          Body: `THE JOURNEY verification code: ${code}. Expires in 10 minutes.`,
        }),
      },
    );
    if (!response.ok) return { sent: false };
    const data = await response.json();
    return {
      sent:
        typeof data.sid === "string" &&
        !["failed", "undelivered", "canceled"].includes(data.status),
    };
  } catch {
    return { sent: false };
  }
}

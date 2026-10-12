/**
 * Maps SECURITY DEFINER RPC error messages (create_contact_request /
 * respond_to_contact / mark_contact_viewed / close_contact / cancel_contact)
 * onto the Arabic UI convention. Unknown messages pass through verbatim so
 * nothing is silently swallowed — same contract as Slice 2 actions.
 */
const KNOWN: Record<string, string> = {
  not_authenticated: "يجب تسجيل الدخول أولًا.",
  offer_not_published: "لا يمكن إرسال طلب تواصل إلا على عرض منشور وساريق.",
  duplicate_active_request:
    "لديك طلب تواصل نشط على هذا العرض بالفعل — تابع حالته بدلًا من إنشاء طلب جديد.",
  "message too short": "الرسالة قصيرة جدًا — اكتب ١٠ أحرف على الأقل.",
  "response message required": "نص الرد مطلوب.",
  forbidden: "غير مصرح بذلك.",
  "not found": "لم يتم العثور على الطلب.",
  agent_not_verified: "الحساب غير موثّق.",
};

export function mapContactError(message: string): string {
  const msg = message ?? "";
  for (const [needle, arabic] of Object.entries(KNOWN)) {
    if (msg.includes(needle)) return arabic;
  }
  if (/invalid state/.test(msg)) return "لا يمكن تنفيذ هذا الإجراء في حالة الطلب الحالية.";
  return msg;
}

/** Client-side mirror of the RPC's message rule (min 10 chars). */
export function validateContactMessage(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? "").trim();
  if (trimmed.length < 10) return "الرسالة قصيرة جدًا — اكتب ١٠ أحرف على الأقل.";
  return null;
}

/** traveler_count must be an integer ≥ 1. */
export function validateTravelerCount(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, MailCheck } from "lucide-react";

export function AccountSecurityPanel({ email, emailVerified, mailReady }: { email: string; emailVerified: boolean; mailReady: boolean }) {
  const [verified, setVerified] = useState(emailVerified);
  const [mailBusy, setMailBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [mailMessage, setMailMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [mailError, setMailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function sendVerification() {
    setMailBusy(true);
    setMailMessage(null);
    setMailError(null);
    try {
      const response = await fetch("/api/auth/email-verification/request", { method: "POST" });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "تعذر إرسال رسالة التأكيد.");
      setMailMessage(data.message ?? "أرسلنا رسالة تأكيد إلى بريدك.");
      if (data.message?.includes("موثّق بالفعل")) setVerified(true);
    } catch (err) {
      setMailError(err instanceof Error ? err.message : "تعذر إرسال رسالة التأكيد.");
    } finally {
      setMailBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordBusy(true);
    setPasswordMessage(null);
    setPasswordError(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (newPassword !== confirmation) {
      setPasswordError("كلمتا المرور الجديدتان غير متطابقتين.");
      setPasswordBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/auth/password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "تعذر تغيير كلمة المرور.");
      setPasswordMessage(data.message ?? "تم تغيير كلمة المرور.");
      formElement.reset();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "تعذر تغيير كلمة المرور.");
    } finally {
      setPasswordBusy(false);
    }
  }

  const inputClass = "w-full rounded-2xl border border-outlinev bg-low/60 px-4 py-3.5 text-left text-[15px] font-semibold outline-none focus:border-signal focus:ring-4 focus:ring-signal/10";

  return (
    <div className="space-y-6">
      <section className="sila-window border border-outlinev bg-cloud p-6">
        <div className="flex items-start gap-3">
          {verified ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-verified" /> : <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-signal" />}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-inkwell">البريد الإلكتروني</h2>
            <p dir="ltr" className="mt-1 break-all text-left font-mono text-xs text-slate">{email}</p>
            <p className="mt-2 text-sm leading-7 text-slate">{verified ? "بريدك موثّق." : "البريد غير موثّق بعد."}</p>
            {!mailReady ? <p role="status" className="mt-3 rounded-xl border border-outlinev bg-low/60 px-3 py-3 text-sm leading-7 text-slate">تأكيد البريد واستعادة الحساب بالبريد غير متاحين حاليًا. تقدر تستخدم حسابك وتغيّر كلمة المرور من هنا.</p> : null}
            {!verified && mailReady ? (
              <button type="button" onClick={() => void sendVerification()} disabled={mailBusy} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-signal px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                {mailBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
                {mailBusy ? "جارٍ الإرسال…" : "إرسال رابط تأكيد"}
              </button>
            ) : null}
            {mailMessage ? <p role="status" className="mt-3 rounded-xl bg-low px-3 py-2 text-sm text-inkwell">{mailMessage}</p> : null}
            {mailError ? <p role="alert" className="mt-3 rounded-xl bg-errorbg px-3 py-2 text-sm text-error">{mailError}</p> : null}
          </div>
        </div>
      </section>

      <section className="sila-window border border-outlinev bg-cloud p-6">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-signal" />
          <h2 className="text-lg font-bold text-inkwell">تغيير كلمة المرور</h2>
        </div>
        <p className="mt-2 text-sm leading-7 text-slate">بعد الحفظ سيتم إنهاء الجلسات القديمة لحماية الحساب.</p>
        <p className="mt-1 text-sm leading-7 text-slate">استخدم عبارة يسهل عليك تذكّرها، من 15 إلى 128 حرفًا.</p>
        <form onSubmit={changePassword} className="mt-5 space-y-4">
          <div>
            <label htmlFor="current-password" className="mb-2 block text-sm font-semibold text-inkwell">كلمة المرور الحالية</label>
            <input id="current-password" required name="currentPassword" type="password" dir="ltr" maxLength={128} autoComplete="current-password" className={inputClass} />
          </div>
          <div>
            <label htmlFor="new-security-password" className="mb-2 block text-sm font-semibold text-inkwell">كلمة المرور الجديدة</label>
            <input id="new-security-password" required name="newPassword" type="password" dir="ltr" minLength={15} maxLength={128} autoComplete="new-password" className={inputClass} />
          </div>
          <div>
            <label htmlFor="new-security-confirmation" className="mb-2 block text-sm font-semibold text-inkwell">تأكيد كلمة المرور الجديدة</label>
            <input id="new-security-confirmation" required name="confirmation" type="password" dir="ltr" minLength={15} maxLength={128} autoComplete="new-password" className={inputClass} />
          </div>

          {passwordMessage ? <p role="status" className="rounded-xl bg-verifiedbg px-3 py-2 text-sm text-verified">{passwordMessage}</p> : null}
          {passwordError ? <p role="alert" className="rounded-xl bg-errorbg px-3 py-2 text-sm text-error">{passwordError}</p> : null}

          <button type="submit" disabled={passwordBusy} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-deep px-6 py-4 text-sm font-bold text-white disabled:opacity-60">
            {passwordBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {passwordBusy ? "جارٍ الحفظ…" : "تغيير كلمة المرور"}
          </button>
        </form>
      </section>
    </div>
  );
}

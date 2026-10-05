"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { SilaLogo } from "@/components/brand/SilaLogo";

export function RecoveryRequestForm({ mailReady }: { mailReady: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/recovery/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(form.get("email") ?? "") }),
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "تعذر إرسال طلب الاستعادة.");
      setMessage(data.message ?? "إذا كان البريد مرتبطًا بحساب فستصلك رسالة استعادة.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إرسال طلب الاستعادة.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-xl items-center px-5 py-12">
      <section className="sila-window w-full border border-outlinev bg-cloud p-7 md:p-9">
        <SilaLogo className="h-10 w-auto" />
        <h1 className="mt-6 text-3xl font-bold text-inkwell">نسيت كلمة المرور؟</h1>
        <p className="mt-2 text-sm leading-7 text-slate">{mailReady
          ? "اكتب بريد حسابك لطلب رابط آمن لاختيار كلمة مرور جديدة."
          : "استعادة الحساب بالبريد غير متاحة حاليًا. تسجيل الدخول وإنشاء حساب جديد متاحان كالمعتاد."}</p>

        {mailReady ? <form onSubmit={submit} className="mt-7 space-y-4">
          <div>
            <label htmlFor="recovery-email" className="mb-2 block text-sm font-semibold text-inkwell">البريد الإلكتروني</label>
            <input
              id="recovery-email"
              required
              name="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              maxLength={200}
              className="w-full rounded-2xl border border-outlinev bg-low/60 px-4 py-3.5 text-left text-[15px] font-semibold outline-none focus:border-signal focus:ring-4 focus:ring-signal/10"
              placeholder="name@example.com"
            />
          </div>

          {message ? <p role="status" className="rounded-xl bg-low px-4 py-3 text-sm leading-6 text-inkwell">{message}</p> : null}
          {error ? <p role="alert" className="rounded-xl bg-errorbg px-4 py-3 text-sm leading-6 text-error">{error}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-signal px-6 py-4 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {busy ? "جارٍ الإرسال…" : "إرسال رابط الاستعادة"}
          </button>
        </form> : <div className="mt-6 rounded-2xl border border-outlinev bg-low/60 p-4 text-sm leading-7 text-slate" role="status">
          لو ما زلت مسجل الدخول، تقدر تغيّر كلمة المرور من <Link href="/account/security" className="font-bold text-deep underline">أمان الحساب</Link>.
        </div>}

        <Link href="/join" className="mt-6 inline-block text-sm font-bold text-deep hover:underline">
          العودة إلى تسجيل الدخول
        </Link>
      </section>
    </main>
  );
}

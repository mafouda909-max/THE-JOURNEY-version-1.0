"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRecoveryToken } from "@/components/useRecoveryToken";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { SilaLogo } from "@/components/brand/SilaLogo";

function ResetForm() {
  const router = useRouter();
  const token = useRecoveryToken();
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password !== confirmation) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/recovery/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json() as { error?: string; destination?: string };
      if (!response.ok) throw new Error(data.error ?? "تعذر تغيير كلمة المرور.");
      router.replace(data.destination === "/account/travel" ? "/account/travel" : "/account");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تغيير كلمة المرور.");
      setBusy(false);
    }
  }

  return (
    <section className="sila-window w-full border border-outlinev bg-cloud p-7 md:p-9">
      <SilaLogo className="h-10 w-auto" />
      <h1 className="mt-6 text-3xl font-bold text-inkwell">اختيار كلمة مرور جديدة</h1>
      <p className="mt-2 text-sm leading-7 text-slate">
        استخدم عبارة من 15 إلى 128 حرفًا. بعد التغيير سننهي الجلسات القديمة لحماية حسابك.
      </p>

      {token === null ? <p className="mt-7 text-sm text-slate" role="status">جارٍ قراءة الرابط الآمن…</p> : !token ? (
        <div className="mt-7">
          <p className="rounded-xl bg-errorbg px-4 py-3 text-sm text-error">رابط الاستعادة غير مكتمل.</p>
          <Link href="/forgot-password" className="mt-5 inline-block text-sm font-bold text-deep hover:underline">اطلب رابطًا جديدًا</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-7 space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-2 block text-sm font-semibold text-inkwell">كلمة المرور الجديدة</label>
            <div className="relative">
              <input
                id="new-password"
                required
                name="password"
                type={show ? "text" : "password"}
                dir="ltr"
                minLength={15}
                maxLength={128}
                autoComplete="new-password"
                className="w-full rounded-2xl border border-outlinev bg-low/60 px-4 py-3.5 pr-14 text-left text-[15px] font-semibold outline-none focus:border-signal focus:ring-4 focus:ring-signal/10"
              />
              <button type="button" onClick={() => setShow((value) => !value)} aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-slate">
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="confirmation" className="mb-2 block text-sm font-semibold text-inkwell">تأكيد كلمة المرور</label>
            <input
              id="confirmation"
              required
              name="confirmation"
              type={show ? "text" : "password"}
              dir="ltr"
              minLength={15}
              maxLength={128}
              autoComplete="new-password"
              className="w-full rounded-2xl border border-outlinev bg-low/60 px-4 py-3.5 text-left text-[15px] font-semibold outline-none focus:border-signal focus:ring-4 focus:ring-signal/10"
            />
          </div>

          {error ? <p role="alert" className="rounded-xl bg-errorbg px-4 py-3 text-sm leading-6 text-error">{error}</p> : null}

          <button type="submit" disabled={busy} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-signal px-6 py-4 text-sm font-bold text-white disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {busy ? "جارٍ الحفظ…" : "حفظ كلمة المرور الجديدة"}
          </button>
        </form>
      )}
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-xl items-center px-5 py-12">
      <Suspense fallback={<div className="w-full text-center text-sm text-slate">جارٍ التحميل…</div>}>
        <ResetForm />
      </Suspense>
    </main>
  );
}

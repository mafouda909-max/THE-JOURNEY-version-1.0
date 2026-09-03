"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Lock, ShieldAlert } from "lucide-react";

export function AdminGate({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const key = String(new FormData(e.currentTarget).get("key") ?? "");
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "تعذّر الدخول");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الدخول");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wash text-deep">
        {configured ? <Lock className="h-7 w-7" /> : <ShieldAlert className="h-7 w-7" />}
      </span>
      <h1 className="mt-8 text-3xl font-bold text-inkwell">منطقة فريق الثقة</h1>

      {configured ? (
        <>
          <p className="mt-3 leading-relaxed text-slate">
            بوابة المراجعة، طلبات التواصل، ومكتب النمو محمية بصلاحيات إدارية.
            أدخل مفتاح الفريق للمتابعة — الجلسة تنتهي خلال ١٢ ساعة.
          </p>
          <form onSubmit={onSubmit} className="mt-8 w-full space-y-4">
            <div className="relative">
              <KeyRound className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
              <input
                name="key"
                type="password"
                required
                dir="ltr"
                placeholder="ADMIN KEY"
                className="w-full rounded-lg border border-outlinev bg-cloud py-3.5 pe-4 ps-11 text-left font-mono text-sm tracking-widest outline-none focus:border-deep focus:ring-4 focus:ring-deep/10"
              />
            </div>
            {error && (
              <p className="rounded-lg bg-errorbg px-4 py-3 text-[13px] font-semibold text-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-deep px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-horizon disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              دخول بوابة الثقة
            </button>
          </form>
        </>
      ) : (
        <div className="mt-6 w-full rounded-xl border border-dashed border-gold/50 bg-amber p-6 text-start">
          <div className="font-bold text-gold">الصلاحيات غير مهيأة بعد</div>
          <p className="mt-2 text-[13px] leading-relaxed text-slate">
            حدّد المتغير <span className="font-mono text-deep">ADMIN_API_KEY</span> في
            بيئة الخادم لتفعيل البوابة. السطح الإداري يقفل نفسه بالكامل حتى
            تكتمل التهيئة — لا وضع مفتوح افتراضي.
          </p>
        </div>
      )}
    </div>
  );
}

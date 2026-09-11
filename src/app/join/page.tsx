"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, UserPlus, KeyRound } from "lucide-react";
import { PassageMark } from "@/components/brand";

type Mode = "login" | "signup-agent" | "signup-traveler";

const MODES: { key: Mode; title: string; hint: string }[] = [
  { key: "login", title: "تسجيل الدخول", hint: "لأصحاب الحسابات القائمة" },
  { key: "signup-agent", title: "حساب وكيل جديد", hint: "سير عمل التوثيق يبدأ بعد التفعيل" },
  { key: "signup-traveler", title: "حساب مسافر", hint: "تابع طلباتك ومحفوظاتك" },
];

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(
    params.get("mode") === "agent" ? "signup-agent" : "login",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload: Record<string, string> = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    let action = "login";
    if (mode !== "login") {
      action = "signup";
      payload.name = String(form.get("name") ?? "");
      payload.role = mode === "signup-agent" ? "agent" : "traveler";
      payload.city = String(form.get("city") ?? "");
    }
    try {
      const res = await fetch(`/api/auth/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "تعذّر الإتمام");
      router.push("/account");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الإتمام");
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-lg border border-outlinev bg-cloud px-4 py-3.5 text-[15px] font-medium outline-none transition-colors placeholder:text-slate/50 focus:border-deep focus:ring-4 focus:ring-deep/10";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16">
      <div className="mb-8 flex justify-center">
        <PassageMark className="h-10 w-10 text-deep" title="الرحلة" />
      </div>
      <h1 className="text-center text-3xl font-bold text-inkwell">
        {MODES.find((m) => m.key === mode)?.title}
      </h1>
      <p className="mt-2 text-center text-sm text-slate">
        {MODES.find((m) => m.key === mode)?.hint}
      </p>

      <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-lg border border-outlinev">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => {
              setMode(m.key);
              setError(null);
            }}
            className={`min-h-11 px-2 py-2.5 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20 ${
              mode === m.key ? "bg-deep text-white" : "bg-cloud text-slate hover:text-deep"
            }`}
          >
            {m.key === "login" ? "دخول" : m.key === "signup-agent" ? "وكيل" : "مسافر"}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {mode !== "login" && (
          <>
            <input required name="name" placeholder={mode === "signup-agent" ? "اسم الوكالة / الوكيل *" : "الاسم الكريم *"} className={field} />
            {mode === "signup-agent" && (
              <input name="city" placeholder="المدينة (الرياض، جدة…)" className={field} />
            )}
          </>
        )}
        <input required name="email" type="email" dir="ltr" placeholder="البريد الإلكتروني *" className={`${field} text-left`} />
        <input required name="password" type="password" dir="ltr" minLength={8} placeholder="كلمة المرور (٨+ أحرف) *" className={`${field} text-left`} />
        {error && (
          <div role="alert" className="rounded-lg border border-error/20 bg-errorbg px-4 py-3 text-sm font-medium text-error">
            {error}
          </div>
        )}
        <button
          disabled={busy}
          type="submit"
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-deep px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-horizon disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? <KeyRound className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {busy ? "جارٍ الإتمام…" : mode === "login" ? "دخول" : "إنشاء الحساب"}
        </button>
      </form>
      <p className="mt-6 text-center text-xs leading-relaxed text-slate">
        إنشاء حساب وكالة لا يعني التوثيق تلقائيًا؛ الظهور العام يتطلب مراجعة الثقة والمستندات.
      </p>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="mx-auto min-h-[70vh] max-w-md px-5 py-16 text-center text-sm text-slate">جارٍ التحميل…</div>}>
      <JoinForm />
    </Suspense>
  );
}

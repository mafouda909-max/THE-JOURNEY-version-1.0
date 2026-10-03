"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, UserPlus, KeyRound } from "lucide-react";
import { SilaLogo } from "@/components/brand/SilaLogo";
import { SilaAgentIcon, SilaIdentityIcon } from "@/components/brand/SilaIcons";

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
    "w-full rounded-2xl border border-outlinev bg-low/60 px-4 py-3.5 text-[15px] font-semibold outline-none transition-all placeholder:text-slate/50 hover:border-sky focus:border-signal focus:bg-cloud focus:ring-4 focus:ring-signal/10";

  return (
    <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl items-stretch gap-6 px-5 py-8 md:px-8 lg:grid-cols-[.9fr_1.1fr] lg:py-12">
      <aside className="relative hidden overflow-hidden rounded-[2rem] bg-deep p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute end-[-80px] top-[-80px] h-72 w-72 rounded-full border border-sky/20" />
        <div aria-hidden className="absolute end-4 top-4 flex gap-2 opacity-80">
          <span className="h-3 w-3 rounded-full bg-signal" />
          <span className="h-3 w-3 rounded-full bg-sky" />
        </div>

        <div>
          <SilaLogo variant="arabic" light priority className="h-12 w-auto" />
          <div className="sila-eyebrow mt-10 text-[11px] font-semibold text-sky">حساب واحد · صلة أوضح</div>
          <h2 className="mt-4 max-w-sm text-4xl font-bold leading-[1.2] tracking-[-0.035em]">
            ادخل بصفتك،
            <span className="block text-air">وخلّي النظام يخدم دورك.</span>
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-7 text-white/65">
            المسافر يتابع طلباته، والوكيل يدير ملفه وعروضه، وكل طرف يرى المعلومات
            التي يحتاجها بدون زحمة أو صلاحيات مبهمة.
          </p>
        </div>

        <div className="grid gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sky">
                <SilaIdentityIcon className="h-5 w-5" />
              </span>
              <div>
                <div className="font-bold">للمسافر</div>
                <div className="mt-1 text-[12px] text-white/55">طلباتك وتاريخ تواصلك في مكان واحد</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sky">
                <SilaAgentIcon className="h-5 w-5" />
              </span>
              <div>
                <div className="font-bold">للوكيل</div>
                <div className="mt-1 text-[12px] text-white/55">التوثيق والعروض وطلبات التواصل</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex items-center">
        <div className="sila-window w-full border border-outlinev bg-cloud p-6 shadow-[0_18px_60px_rgba(8,38,74,0.08)] md:p-9">
          <div className="mb-8 flex justify-center lg:hidden">
            <SilaLogo variant="arabic" priority className="h-10 w-auto" />
          </div>

          <div className="text-center lg:text-start">
            <div className="sila-eyebrow text-[11px] font-semibold text-signal">
              {mode === "login" ? "عودة للحساب" : "بداية صلة جديدة"}
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-inkwell">
              {MODES.find((m) => m.key === mode)?.title}
            </h1>
            <p className="mt-2 text-sm text-slate">
              {MODES.find((m) => m.key === mode)?.hint}
            </p>
          </div>

          <div className="mt-7 grid grid-cols-3 rounded-2xl bg-low p-1">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={mode === m.key}
                onClick={() => {
                  setMode(m.key);
                  setError(null);
                }}
                className={`rounded-xl px-2 py-2.5 text-[12px] font-bold transition-all ${
                  mode === m.key
                    ? "bg-cloud text-deep shadow-sm"
                    : "text-slate hover:text-deep"
                }`}
              >
                {m.key === "login" ? "دخول" : m.key === "signup-agent" ? "وكيل" : "مسافر"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            {mode !== "login" && (
              <>
                <input required name="name" aria-label={mode === "signup-agent" ? "اسم الوكالة أو الوكيل" : "اسم المسافر"} autoComplete="name" placeholder={mode === "signup-agent" ? "اسم الوكالة / الوكيل *" : "الاسم الكريم *"} className={field} />
                {mode === "signup-agent" && (
                  <input name="city" aria-label="المدينة" autoComplete="address-level2" placeholder="المدينة (الرياض، جدة…)" className={field} />
                )}
              </>
            )}
            <input required name="email" type="email" dir="ltr" aria-label="البريد الإلكتروني" autoComplete="email" placeholder="البريد الإلكتروني *" className={`${field} text-left`} />
            <input required name="password" type="password" dir="ltr" minLength={8} aria-label="كلمة المرور" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="كلمة المرور (٨+ أحرف) *" className={`${field} text-left`} />
            {error && (
              <p className="rounded-2xl bg-errorbg px-4 py-3 text-[13px] font-semibold text-error">{error}</p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="sila-motion-safe flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-signal px-6 py-4 text-[15px] font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-horizon disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : mode === "login" ? <KeyRound className="h-4 w-4" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
              {mode === "login" ? "دخول" : "إنشاء الحساب"}
            </button>
          </form>

          {mode === "signup-agent" && (
            <p className="mt-5 rounded-2xl border border-sky/40 bg-air/50 px-4 py-3 text-[12px] leading-relaxed text-slate">
              بعد إنشاء الحساب تبدأ رحلة التوثيق: ملفك يراجعه فريق الثقة قبل التفعيل، ولن تظهر شارة «موثّق» أو عروضك للعامة قبل قرار الاعتماد.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  );
}

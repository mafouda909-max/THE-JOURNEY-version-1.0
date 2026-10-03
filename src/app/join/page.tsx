"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { SilaLogo } from "@/components/brand/SilaLogo";
import { SilaAgentIcon, SilaIdentityIcon } from "@/components/brand/SilaIcons";

type Mode = "login" | "signup-agent" | "signup-traveler";

const MODES: { key: Mode; title: string; hint: string }[] = [
  { key: "login", title: "تسجيل الدخول", hint: "للحسابات القائمة — الدور الحالي لا يتغير" },
  { key: "signup-agent", title: "حساب وكيل جديد", hint: "يبدأ بحالة انتظار حتى مراجعة التوثيق" },
  { key: "signup-traveler", title: "حساب مسافر جديد", hint: "احفظ الرحلات وتابع الطلبات والمقارنات" },
];

const ERROR_COPY: Record<string, string> = {
  google_not_configured: "تسجيل Google غير مفعّل في هذه البيئة.",
  google_state_invalid: "انتهت أو فشلت جلسة Google الآمنة. ابدأ المحاولة من جديد.",
  google_token_exchange_failed: "تعذر إكمال التحقق مع Google.",
  google_profile_failed: "تعذر قراءة حساب Google الموثق.",
  google_email_not_verified: "حساب Google لا يقدّم بريدًا موثقًا.",
  account_not_found: "لا يوجد حساب بهذا البريد. اختر إنشاء حساب مسافر أو وكيل.",
  admin_google_link_not_allowed: "حساب الإدارة غير مصرح له بربط Google تلقائيًا.",
  admin_magic_link_disabled: "حسابات الإدارة لا تستخدم Magic Link.",
  magic_link_invalid: "رابط الدخول غير صالح.",
  magic_link_expired_or_used: "رابط الدخول منتهي أو تم استخدامه بالفعل.",
  identity_already_linked: "هذه الهوية مرتبطة بحساب آخر.",
  identity_conflict: "تعذر ربط الهوية بالحساب بشكل آمن.",
};

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const requestedMode = params.get("mode");
  const [mode, setMode] = useState<Mode>(
    requestedMode === "agent"
      ? "signup-agent"
      : requestedMode === "new-traveler"
        ? "signup-traveler"
        : "login",
  );
  const [magicBusy, setMagicBusy] = useState(false);
  const [legacyBusy, setLegacyBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [authConfig, setAuthConfig] = useState<{
    google: boolean;
    magic: boolean;
    legacyPassword: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(
    params.get("error") ? ERROR_COPY[params.get("error")!] ?? "تعذر إكمال تسجيل الدخول." : null,
  );

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/config", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("config");
        return await response.json() as {
          google?: boolean;
          magic?: boolean;
          legacyPassword?: boolean;
        };
      })
      .then((config) => {
        if (!active) return;
        setAuthConfig({
          google: config.google === true,
          magic: config.magic === true,
          legacyPassword: config.legacyPassword === true,
        });
      })
      .catch(() => {
        if (active) setAuthConfig({ google: false, magic: false, legacyPassword: false });
      });
    return () => {
      active = false;
    };
  }, []);

  const googleEnabled = authConfig?.google === true;
  const magicEnabled = authConfig?.magic === true;
  const legacyPasswordEnabled = authConfig?.legacyPassword === true;

  const role = mode === "signup-agent" ? "agent" : "traveler";
  const intent = mode === "login" ? "login" : "signup";
  const googleHref = `/api/auth/google/start?intent=${intent}&role=${role}`;

  async function requestMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMagicBusy(true);
    setError(null);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      email: String(form.get("email") ?? ""),
      name: String(form.get("name") ?? ""),
      city: String(form.get("city") ?? ""),
      role,
      intent,
    };

    try {
      const response = await fetch("/api/auth/magic/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر إرسال رابط الدخول.");
      setMessage(data.message ?? "تحقق من بريدك لإكمال الدخول.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إرسال رابط الدخول.");
    } finally {
      setMagicBusy(false);
    }
  }

  async function legacyLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLegacyBusy(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("legacyEmail") ?? ""),
          password: String(form.get("legacyPassword") ?? ""),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر تسجيل الدخول.");
      router.push("/account");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل الدخول.");
      setLegacyBusy(false);
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
          <div className="sila-eyebrow mt-10 text-[11px] font-semibold text-sky">
            حساب واحد · صلة أوضح
          </div>
          <h2 className="mt-4 max-w-sm text-4xl font-bold leading-[1.2] tracking-[-0.035em]">
            ادخل بهوية موثقة،
            <span className="block text-air">واحتفظ بدورك وصلاحياتك.</span>
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-7 text-white/65">
            Google أو رابط بريد لمرة واحدة هما المساران الأساسيان. لا ننشئ صلاحية
            إدارة ذاتيًا، ولا نرفع حساب المسافر إلى وكيل أو العكس بمجرد تطابق البريد.
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
                <div className="mt-1 text-[12px] text-white/55">نية السفر والمقارنات والطلبات في حساب واحد</div>
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
                <div className="mt-1 text-[12px] text-white/55">الحساب يبدأ Pending حتى مراجعة التوثيق</div>
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
              {MODES.find((item) => item.key === mode)?.title}
            </h1>
            <p className="mt-2 text-sm text-slate">
              {MODES.find((item) => item.key === mode)?.hint}
            </p>
          </div>

          <div className="mt-7 grid grid-cols-3 rounded-2xl bg-low p-1">
            {MODES.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={mode === item.key}
                onClick={() => {
                  setMode(item.key);
                  setError(null);
                  setMessage(null);
                }}
                className={`rounded-xl px-2 py-2.5 text-[12px] font-bold transition-all ${
                  mode === item.key ? "bg-cloud text-deep shadow-sm" : "text-slate hover:text-deep"
                }`}
              >
                {item.key === "login" ? "دخول" : item.key === "signup-agent" ? "وكيل جديد" : "مسافر جديد"}
              </button>
            ))}
          </div>

          {googleEnabled ? (
            <a
              href={googleHref}
              className="mt-7 flex min-h-[52px] w-full items-center justify-center gap-3 rounded-2xl border border-outlinev bg-white px-6 py-4 text-[15px] font-bold text-inkwell transition-all hover:border-sky hover:bg-air/40"
            >
              <span aria-hidden className="text-lg font-black text-signal">G</span>
              المتابعة باستخدام Google
            </a>
          ) : null}

          {googleEnabled && magicEnabled ? (
            <div className="my-5 flex items-center gap-3 text-[11px] font-semibold text-slate">
              <span className="h-px flex-1 bg-outlinev" />
              أو
              <span className="h-px flex-1 bg-outlinev" />
            </div>
          ) : null}

          {magicEnabled ? (
            <form onSubmit={requestMagicLink} className={googleEnabled ? "space-y-4" : "mt-7 space-y-4"}>
              {mode !== "login" ? (
                <>
                  <input
                    required
                    name="name"
                    aria-label={mode === "signup-agent" ? "اسم الوكالة أو الوكيل" : "اسم المسافر"}
                    autoComplete="name"
                    placeholder={mode === "signup-agent" ? "اسم الوكالة / الوكيل *" : "الاسم الكريم *"}
                    className={field}
                  />
                  {mode === "signup-agent" ? (
                    <input
                      name="city"
                      aria-label="المدينة"
                      autoComplete="address-level2"
                      placeholder="المدينة"
                      className={field}
                    />
                  ) : null}
                </>
              ) : null}
              <input
                required
                name="email"
                type="email"
                dir="ltr"
                aria-label="البريد الإلكتروني"
                autoComplete="email"
                placeholder="البريد الإلكتروني *"
                className={`${field} text-left`}
              />
              <button
                type="submit"
                disabled={magicBusy}
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-signal px-6 py-4 text-[15px] font-bold text-white transition-all hover:bg-horizon disabled:opacity-60"
              >
                {magicBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mail className="h-4 w-4" aria-hidden="true" />}
                إرسال رابط دخول آمن
              </button>
            </form>
          ) : null}

          {message ? (
            <p className="mt-4 rounded-2xl bg-verifiedbg px-4 py-3 text-[13px] font-semibold text-verified">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-2xl bg-errorbg px-4 py-3 text-[13px] font-semibold text-error">
              {error}
            </p>
          ) : null}

          {legacyPasswordEnabled && mode === "login" ? (
            <details className="mt-6 rounded-2xl border border-outlinev bg-low/40 p-4">
              <summary className="cursor-pointer text-[12px] font-bold text-slate">
                لدي حساب قديم بكلمة مرور
              </summary>
              <form onSubmit={legacyLogin} className="mt-4 space-y-3">
                <input
                  required
                  name="legacyEmail"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  aria-label="بريد الحساب القديم"
                  placeholder="البريد الإلكتروني"
                  className={`${field} text-left`}
                />
                <input
                  required
                  name="legacyPassword"
                  type="password"
                  dir="ltr"
                  minLength={8}
                  autoComplete="current-password"
                  aria-label="كلمة المرور القديمة"
                  placeholder="كلمة المرور القديمة"
                  className={`${field} text-left`}
                />
                <button
                  type="submit"
                  disabled={legacyBusy}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-outlinev bg-cloud px-4 py-3 text-sm font-bold text-deep disabled:opacity-60"
                >
                  {legacyBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
                  دخول الحساب القديم
                </button>
              </form>
            </details>
          ) : null}

          {authConfig === null ? (
            <p className="mt-7 rounded-2xl border border-outlinev bg-low/50 px-4 py-3 text-[13px] font-semibold text-slate">
              جارٍ التحقق من وسائل الدخول المتاحة…
            </p>
          ) : !googleEnabled && !magicEnabled && !legacyPasswordEnabled ? (
            <p className="mt-7 rounded-2xl border border-warning/20 bg-warningbg px-4 py-3 text-[13px] font-semibold text-warning">
              وسائل الدخول غير مفعّلة في هذه البيئة بعد.
            </p>
          ) : null}

          <div className="mt-6 flex items-start gap-2 rounded-2xl bg-air/50 px-4 py-3 text-[11px] leading-relaxed text-slate">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-signal" aria-hidden="true" />
            <span>
              حسابات الإدارة تُنشأ داخليًا فقط ولا يوجد تسجيل Admin ذاتي. الحسابات القديمة تحتفظ
              بأدوارها عند ربط Google أو البريد.
            </span>
          </div>

          {mode === "signup-agent" ? (
            <p className="mt-4 rounded-2xl border border-sky/40 bg-air/50 px-4 py-3 text-[12px] leading-relaxed text-slate">
              إنشاء حساب الوكيل لا يعني التوثيق. يظل الحساب Pending حتى قرار مراجعة فعلي.
            </p>
          ) : null}
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

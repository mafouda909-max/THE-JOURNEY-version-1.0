"use client";

import { useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Clock3, Loader2, Lock, Send } from "lucide-react";

type Status = "idle" | "sending" | "success" | "error";

export function ContactForm({
  offerId,
  offerTitle,
  minTravelers,
  maxTravelers,
}: {
  offerId: number;
  offerTitle: string;
  minTravelers: number;
  maxTravelers: number;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [reference, setReference] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firedStart = useRef(false);

  const fire = (name: string) =>
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, offerId }),
    }).catch(() => undefined);

  const onFirstFocus = () => {
    if (firedStart.current) return;
    firedStart.current = true;
    void fire("contact_started");
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const params = new URLSearchParams(window.location.search);
      const response = await fetch("/api/contact-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId,
          travelerName: String(form.get("name") ?? ""),
          travelerEmail: String(form.get("email") ?? ""),
          travelerCount: Number(form.get("count") ?? minTravelers),
          travelDates: String(form.get("dates") ?? ""),
          message: String(form.get("message") ?? ""),
          utmSource: params.get("utm_source"),
          utmMedium: params.get("utm_medium"),
          utmCampaign: params.get("utm_campaign"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذّر الإرسال");
      setReference(data.id);
      setStatus("success");
      void fire("contact_submitted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الإرسال");
      setStatus("error");
    }
  }

  const field =
    "w-full rounded-lg border border-outlinev bg-cloud px-4 py-3 text-[15px] font-medium text-inkwell outline-none transition-colors placeholder:text-slate/50 focus:border-deep focus:ring-4 focus:ring-deep/10";

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {status === "success" ? (
          <motion.div
            key="ok"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="mx-auto h-11 w-11 text-verified" strokeWidth={1.5} aria-hidden="true" />
            <h3 className="mt-4 text-xl font-bold text-inkwell">وصل طلبك للوكيل.</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate">
              مرجع الطلب{" "}
              <span className="tnum font-mono font-semibold text-deep">
                TRQ-{String(reference).padStart(4, "0")}
              </span>
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-wash px-4 py-2.5 text-[13px] font-semibold text-deep">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              الحالة: طلب جديد — بانتظار مشاهدة الوكيل
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-slate">
              سيصلك رد الوكيل عبر البريد عند استجابته. لا نعرض زمن رد مضمونًا؛ وإذا كنت مسجّل الدخول يمكنك متابعة حالة الطلب من حسابك.
            </p>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="mt-5 text-[13px] font-semibold text-deep underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20"
            >
              إرسال طلب آخر
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            exit={{ opacity: 0, y: -12 }}
            onSubmit={onSubmit}
            onFocusCapture={onFirstFocus}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-[12px] font-semibold text-slate">الاسم</span>
                <input required name="name" minLength={2} maxLength={120} autoComplete="name" placeholder="الاسم الكريم *" className={field} />
              </label>
              <label>
                <span className="mb-1.5 block text-[12px] font-semibold text-slate">البريد الإلكتروني</span>
                <input
                  required
                  name="email"
                  type="email"
                  dir="ltr"
                  maxLength={200}
                  autoComplete="email"
                  placeholder="البريد الإلكتروني *"
                  className={`${field} text-left`}
                />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-[12px] font-semibold text-slate">عدد المسافرين</span>
                <input
                  required
                  name="count"
                  type="number"
                  min={minTravelers}
                  max={maxTravelers}
                  defaultValue={Math.max(minTravelers, Math.min(2, maxTravelers))}
                  className={`${field} tnum`}
                />
                <span className="mt-1 block text-[11px] text-slate">المتاح لهذا العرض: {minTravelers}–{maxTravelers}</span>
              </label>
              <label>
                <span className="mb-1.5 block text-[12px] font-semibold text-slate">التواريخ المقترحة</span>
                <input name="dates" maxLength={200} placeholder="مثال: الأسبوع الأول من أكتوبر" className={field} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-slate">رسالتك للوكيل</span>
              <textarea
                required
                name="message"
                rows={4}
                minLength={10}
                maxLength={2000}
                placeholder={`سؤالك للوكيل عن «${offerTitle}»… *`}
                className={`${field} resize-none`}
              />
            </label>
            {status === "error" && (
              <p className="rounded-lg bg-errorbg px-4 py-3 text-[13px] font-semibold text-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={status === "sending"}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-deep px-6 py-4 text-[15px] font-bold text-white transition-all duration-300 hover:bg-horizon focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20 disabled:opacity-60"
            >
              {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              {status === "sending" ? "جارٍ الإرسال…" : "أرسل طلب التواصل"}
            </button>
            <p className="flex items-start gap-2 text-[12px] leading-relaxed text-slate">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              لا يظهر بريدك إلا للوكيل صاحب العرض، ولا نعرض أي أرقام تواصل خارج المنصة — وفق سياسة المحتوى.
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

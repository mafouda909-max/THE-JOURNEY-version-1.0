"use client";

import { useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Clock3, Loader2, Lock, Send } from "lucide-react";

type Status = "idle" | "sending" | "success" | "error";

export function ContactForm({
  offerId,
  offerTitle,
}: {
  offerId: number;
  offerTitle: string;
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

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const params = new URLSearchParams(window.location.search);
      const res = await fetch("/api/contact-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId,
          travelerName: String(form.get("name") ?? ""),
          travelerEmail: String(form.get("email") ?? ""),
          travelerCount: Number(form.get("count") ?? 2),
          travelDates: String(form.get("dates") ?? ""),
          message: String(form.get("message") ?? ""),
          utmSource: params.get("utm_source"),
          utmMedium: params.get("utm_medium"),
          utmCampaign: params.get("utm_campaign"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "تعذّر الإرسال");
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
          >
            <CheckCircle2 className="mx-auto h-11 w-11 text-verified" strokeWidth={1.5} />
            <h3 className="mt-4 text-xl font-bold text-inkwell">وصل طلبك للوكيل.</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate">
              مرجع الطلب{" "}
              <span className="tnum font-mono font-semibold text-deep">
                TRQ-{String(reference).padStart(4, "0")}
              </span>
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-wash px-4 py-2.5 text-[13px] font-semibold text-deep">
              <Clock3 className="h-4 w-4" />
              الحالة: طلب جديد — بانتظار مشاهدة الوكيل
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-slate">
              يرد الوكيل عبر بريدك خلال ٤٨ ساعة كحد أقصى — معدل استجابة هذا
              الوكيل أعلى من ذلك بكثير عادة.
            </p>
            <button
              onClick={() => setStatus("idle")}
              className="mt-5 text-[13px] font-semibold text-deep underline-offset-4 hover:underline"
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
            <div className="grid grid-cols-2 gap-4">
              <input required name="name" placeholder="الاسم الكريم *" className={field} />
              <input
                required
                name="email"
                type="email"
                dir="ltr"
                placeholder="البريد الإلكتروني *"
                className={`${field} text-left`}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input
                name="count"
                type="number"
                min={1}
                max={14}
                defaultValue={2}
                className={`${field} tnum`}
                placeholder="عدد المسافرين"
              />
              <input
                name="dates"
                placeholder="التواريخ المقترحة (مرنة)"
                className={field}
              />
            </div>
            <textarea
              required
              name="message"
              rows={4}
              placeholder={`سؤالك للوكيل عن «${offerTitle}»… *`}
              className={`${field} resize-none`}
            />
            {status === "error" && (
              <p className="rounded-lg bg-errorbg px-4 py-3 text-[13px] font-semibold text-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={status === "sending"}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-deep px-6 py-4 text-[15px] font-bold text-white transition-all duration-300 hover:bg-horizon disabled:opacity-60"
            >
              {status === "sending" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {status === "sending" ? "جارٍ الإرسال…" : "أرسل طلب التواصل"}
            </button>
            <p className="flex items-start gap-2 text-[12px] leading-relaxed text-slate">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              لا يظهر بريدك إلا للوكيل صاحب العرض، ولا نعرض أي أرقام تواصل خارج
              المنصة — وفق سياسة المحتوى.
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

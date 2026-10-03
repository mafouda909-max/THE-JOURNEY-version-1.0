"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, PlusCircle, X } from "lucide-react";
import { scoreOfferClarity } from "@/lib/offer-clarity";
import { SilaReviewIcon, SilaSparkIcon } from "@/components/brand/SilaIcons";
import { TRIP_TYPES } from "@/lib/format";

export function AccountOfferForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [assistBusy, setAssistBusy] = useState(false);
  const [assistNote, setAssistNote] = useState<string | null>(null);
  const [assistMissing, setAssistMissing] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [clarity, setClarity] = useState(() => scoreOfferClarity({}));

  function refreshClarity(form: HTMLFormElement) {
    const data = new FormData(form);
    const value = (key: string) => String(data.get(key) ?? "");
    setClarity(
      scoreOfferClarity({
        title: value("title"),
        description: value("description"),
        originCity: value("originCity"),
        destinationCity: value("destinationCity"),
        destinationCountry: value("destinationCountry"),
        priceAmount: value("priceAmount"),
        priceType: value("priceType"),
        durationDays: value("durationDays"),
        includes: value("includes"),
        excludes: value("excludes"),
      }),
    );
  }

  async function assistDraft() {
    const form = formRef.current;
    if (!form) return;

    setAssistBusy(true);
    setError(null);
    setAssistNote(null);

    const data = new FormData(form);
    const value = (key: string) => String(data.get(key) ?? "");
    const lines = (v: string) =>
      v
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);

    try {
      const res = await fetch("/api/ai/offer-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: value("title"),
          description: value("description"),
          originCity: value("originCity"),
          destinationCity: value("destinationCity"),
          destinationCountry: value("destinationCountry"),
          priceAmount: Number(value("priceAmount") || 0),
          currency: value("currency"),
          priceType: value("priceType"),
          durationDays: Number(value("durationDays") || 0),
          includes: lines(value("includes")),
          excludes: lines(value("excludes")),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "تعذّر تشغيل مساعد الوضوح");

      const title = form.elements.namedItem("title");
      const description = form.elements.namedItem("description");
      if (title instanceof HTMLInputElement && result.suggestedTitle) {
        title.value = result.suggestedTitle;
      }
      if (description instanceof HTMLTextAreaElement && result.suggestedDescription) {
        description.value = result.suggestedDescription;
      }

      setAssistMissing(Array.isArray(result.missing) ? result.missing : []);
      setAssistNote(
        result.note ??
          "تم اقتراح صياغة أوضح من نفس معلوماتك. راجعها قبل الإرسال.",
      );
      refreshClarity(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تشغيل مساعد الوضوح");
    } finally {
      setAssistBusy(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const s = (k: string) => String(form.get(k) ?? "");
    const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);

    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: s("title"),
          titleEn: s("titleEn"),
          description: s("description"),
          tripType: s("tripType"),
          originCity: s("originCity"),
          destinationCity: s("destinationCity"),
          destinationCountry: s("destinationCountry"),
          destinationCountryEn: s("destinationCountryEn"),
          priceAmount: Number(s("priceAmount")),
          currency: s("currency"),
          priceType: s("priceType"),
          durationDays: s("durationDays") ? Number(s("durationDays")) : null,
          maxTravelers: Number(s("maxTravelers") || 8),
          includes: lines(s("includes")),
          excludes: lines(s("excludes")),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "تعذّر الإرسال");
      setDone(data.message);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الإرسال");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-2xl border border-outlinev bg-low/60 px-4 py-3.5 text-[14px] font-semibold outline-none transition-all placeholder:text-slate/50 hover:border-sky focus:border-signal focus:bg-cloud focus:ring-4 focus:ring-signal/10";

  if (done) {
    return (
      <div className="rounded-xl border border-verified/30 bg-verifiedbg p-6 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-verified" strokeWidth={1.5} />
        <p className="mt-3 font-bold text-inkwell">وصل عرضك لطابور المراجعة.</p>
        <p className="mt-1.5 text-sm text-slate">{done}</p>
        <button
          onClick={() => setDone(null)}
          className="mt-4 text-[13px] font-bold text-deep underline-offset-4 hover:underline"
        >
          إنشاء عرض آخر
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="sila-motion-safe inline-flex items-center gap-2 rounded-2xl bg-signal px-5 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-horizon"
      >
        <PlusCircle className="h-4 w-4" />
        إنشاء عرض جديد
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onInput={(event) => {
        refreshClarity(event.currentTarget);
        setAssistNote(null);
      }}
      onChange={(event) => {
        refreshClarity(event.currentTarget);
        setAssistNote(null);
      }}
      className="sila-window space-y-5 border border-outlinev bg-cloud p-6 shadow-[0_14px_46px_rgba(8,38,74,0.06)]"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="sila-eyebrow text-[11px] font-semibold text-signal">عرض أوضح قبل المراجعة</div>
          <h3 className="mt-2 text-xl font-bold text-inkwell">أنشئ العرض على خطوات مفهومة</h3>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="text-slate hover:text-inkwell">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="rounded-2xl border border-sky/40 bg-air/45 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[12px] font-bold text-deep">مؤشر وضوح العرض</div>
            <div className="mt-1 text-[11px] leading-5 text-slate">
              يقيس اكتمال المعلومات فقط — لا يعني التوثيق، ولا يَعِد بمبيعات أكثر.
            </div>
          </div>
          <div className="text-end">
            <div className="tnum text-2xl font-bold text-deep">{clarity.score}%</div>
            <div className="text-[11px] font-semibold text-signal">{clarity.label}</div>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-cloud">
          <div
            className="h-full rounded-full bg-signal transition-[width] duration-300"
            style={{ width: `${clarity.score}%` }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {clarity.checks.map((item) => (
            <span
              key={item.key}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                item.done ? "bg-verifiedbg text-verified" : "bg-cloud text-slate"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${item.done ? "bg-verified" : "bg-outlinev"}`} />
              {item.label}
            </span>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-sky/30 pt-4">
          <button
            type="button"
            onClick={() => void assistDraft()}
            disabled={assistBusy}
            className="sila-interactive inline-flex items-center gap-2 rounded-xl border border-sky bg-cloud px-3.5 py-2.5 text-[12px] font-bold text-signal hover:bg-signal hover:text-white disabled:opacity-50"
          >
            {assistBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SilaSparkIcon className="h-4 w-4" />
            )}
            {assistBusy ? "يراجع الصياغة…" : "ساعدني أوضح الصياغة"}
          </button>
          <span className="text-[11px] leading-5 text-slate">
            يعيد صياغة ما كتبته فقط، ولا يضيف حقائق أو ينشر بالنيابة عنك.
          </span>
        </div>

        {assistNote && (
          <div className="mt-3 rounded-xl bg-cloud/80 px-3.5 py-3 text-[11px] leading-5 text-slate">
            <div className="font-semibold text-deep">{assistNote}</div>
            {assistMissing.length > 0 && (
              <div className="mt-1">
                ما زال يحتاج: {assistMissing.join(" · ")}
              </div>
            )}
          </div>
        )}
      </div>

      <input required name="title" placeholder="عنوان العرض — دقيق وصادق (٢٠+ حرفًا) *" minLength={10} className={field} />
      <input name="titleEn" dir="ltr" placeholder="English title (optional)" className={`${field} text-left`} />
      <textarea required name="description" rows={4} minLength={60} placeholder="الوصف الكامل: البرنامج يومًا بيوم باختصار، ما الذي يجعله صادقًا، ولمن لا يناسب *" className={`${field} resize-none`} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <select name="tripType" className={field} defaultValue="package">
          {TRIP_TYPES.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        <input required name="originCity" placeholder="من مدينة *" className={field} />
        <input required name="destinationCity" placeholder="إلى مدينة *" className={field} />
        <input required name="destinationCountry" placeholder="الدولة *" className={field} />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <input required name="destinationCountryEn" dir="ltr" placeholder="Country (EN) *" className={`${field} text-left`} />
        <input required name="priceAmount" type="number" min={100} placeholder="السعر *" className={`${field} tnum`} />
        <select name="currency" className={field} defaultValue="SAR">
          {["SAR", "AED", "USD", "EGP", "EUR"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select name="priceType" className={field} defaultValue="per_person">
          <option value="per_person">للفرد</option>
          <option value="per_group">للمجموعة</option>
          <option value="starting_from">يبدأ من</option>
        </select>
        <input name="durationDays" type="number" min={1} max={45} placeholder="الأيام" className={`${field} tnum`} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <textarea required name="includes" rows={3} placeholder="المشمولات — سطر لكل بند * (تأشيرة، إقامة ٤ نجوم شاملة الإفطار…)" className={`${field} resize-none`} />
        <textarea name="excludes" rows={3} placeholder="المستثنيات — سطر لكل بند (الطيران الدولي، التأمين…)" className={`${field} resize-none`} />
      </div>

      {error && (
        <p className="rounded-lg bg-errorbg px-4 py-3 text-[13px] font-semibold text-error">{error}</p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="sila-motion-safe inline-flex items-center gap-2 rounded-2xl bg-signal px-6 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-horizon disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SilaReviewIcon className="h-4 w-4" />}
          إرسال للمراجعة
        </button>
        <p className="text-[12px] leading-relaxed text-slate">
          الهدف هنا ليس “تجميل” العرض؛ الهدف أن يفهم المسافر السعر والمشمولات والحدود قبل أن يتواصل.
        </p>
      </div>
    </form>
  );
}

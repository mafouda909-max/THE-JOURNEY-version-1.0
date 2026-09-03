"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, PlusCircle, X } from "lucide-react";
import { TRIP_TYPES } from "@/lib/format";

export function AccountOfferForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

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
    "w-full rounded-lg border border-outlinev bg-cloud px-4 py-3 text-[14px] font-medium outline-none transition-colors placeholder:text-slate/50 focus:border-deep focus:ring-4 focus:ring-deep/10";

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
        className="inline-flex items-center gap-2 rounded-lg bg-deep px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-horizon"
      >
        <PlusCircle className="h-4 w-4" />
        إنشاء عرض جديد
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-outlinev bg-low/50 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-inkwell">عرض جديد — يدخل المراجعة مباشرة</h3>
        <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="text-slate hover:text-inkwell">
          <X className="h-5 w-5" />
        </button>
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
          className="inline-flex items-center gap-2 rounded-lg bg-deep px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-horizon disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
          إرسال للمراجعة
        </button>
        <p className="text-[12px] leading-relaxed text-slate">
          الأسعار المضللة و«يبدأ من» المبهمة سبب رفض موثَّق — راجع سياسة المحتوى.
        </p>
      </div>
    </form>
  );
}

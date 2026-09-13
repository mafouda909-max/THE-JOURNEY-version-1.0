"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, PencilLine, PlusCircle, X } from "lucide-react";
import { TRIP_TYPES } from "@/lib/format";

type EditableOffer = {
  id: number;
  title: string;
  titleEn: string | null;
  description: string;
  tripType: string;
  originCity: string;
  destinationCity: string;
  destinationCountry: string;
  destinationCountryEn: string;
  priceAmount: number;
  currency: string;
  priceType: string;
  durationDays: number | null;
  maxTravelers: number;
  includes: string[];
  excludes: string[];
};

export function AccountOfferForm({ offer }: { offer?: EditableOffer }) {
  const router = useRouter();
  const isResubmit = Boolean(offer);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    const form = new FormData(e.currentTarget);
    const s = (key: string) => String(form.get(key) ?? "");
    const lines = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);

    try {
      const res = await fetch(isResubmit ? `/api/offers/${offer!.id}` : "/api/offers", {
        method: isResubmit ? "PUT" : "POST",
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
      const data = await res.json() as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? "تعذّر الإرسال");
      setDone(data.message ?? (isResubmit ? "أُعيد العرض إلى المراجعة." : "دخل العرض طابور المراجعة."));
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الإرسال");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1.5 w-full rounded-lg border border-outlinev bg-cloud px-4 py-3 text-[14px] font-medium outline-none transition-colors placeholder:text-slate/50 focus:border-deep focus:ring-4 focus:ring-deep/10";
  const label = "block text-[12px] font-bold text-slate";

  if (done && !open) {
    return (
      <div className="rounded-xl border border-verified/30 bg-verifiedbg p-4" role="status" aria-live="polite">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-verified" strokeWidth={1.5} aria-hidden="true" />
          <div>
            <p className="font-bold text-inkwell">{isResubmit ? "أُعيد العرض إلى فريق المراجعة." : "وصل عرضك لطابور المراجعة."}</p>
            <p className="mt-1 text-sm leading-6 text-slate">{done}</p>
            {!isResubmit && (
              <button
                type="button"
                onClick={() => { setDone(null); setOpen(true); }}
                className="mt-2 text-[12px] font-bold text-deep underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep"
              >
                إنشاء عرض آخر
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setError(null); setDone(null); }}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep focus-visible:ring-offset-2 ${
          isResubmit ? "border border-deep/25 bg-white text-deep hover:bg-low" : "bg-deep text-white hover:bg-horizon"
        }`}
      >
        {isResubmit ? <PencilLine className="h-4 w-4" aria-hidden="true" /> : <PlusCircle className="h-4 w-4" aria-hidden="true" />}
        {isResubmit ? "تعديل وإعادة الإرسال" : "إنشاء عرض جديد"}
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} aria-busy={busy} className="space-y-5 rounded-2xl border border-outlinev bg-low/50 p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-inkwell">{isResubmit ? "تعديل العرض المرفوض" : "عرض جديد — يدخل المراجعة مباشرة"}</h3>
          {isResubmit && <p className="mt-1 text-xs leading-6 text-slate">صحّح سبب الرفض وراجع كل التفاصيل. الحفظ هنا يعيد العرض إلى <strong>pending review</strong> ولا ينشره مباشرة.</p>}
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="إغلاق نموذج العرض"
          className="rounded-md p-1 text-slate hover:text-inkwell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={label}>عنوان العرض بالعربية *
          <input required name="title" defaultValue={offer?.title ?? ""} placeholder="عنوان دقيق وصادق — ١٠ أحرف على الأقل" minLength={10} maxLength={160} className={field} />
        </label>
        <label className={label}>العنوان بالإنجليزية
          <input name="titleEn" dir="ltr" defaultValue={offer?.titleEn ?? ""} maxLength={160} placeholder="English title (optional)" className={`${field} text-left`} />
        </label>
      </div>

      <label className={label}>الوصف الكامل *
        <textarea required name="description" defaultValue={offer?.description ?? ""} rows={4} minLength={60} maxLength={4000} placeholder="اشرح البرنامج وما يشمله بوضوح — ٦٠ حرفًا على الأقل" className={`${field} resize-y`} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className={label}>نوع الرحلة *
          <select name="tripType" className={field} defaultValue={offer?.tripType ?? "package"}>
            {TRIP_TYPES.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
          </select>
        </label>
        <label className={label}>مدينة الانطلاق *
          <input required name="originCity" defaultValue={offer?.originCity ?? ""} maxLength={60} placeholder="مثال: القاهرة" className={field} />
        </label>
        <label className={label}>مدينة الوجهة *
          <input required name="destinationCity" defaultValue={offer?.destinationCity ?? ""} maxLength={60} placeholder="مثال: إسطنبول" className={field} />
        </label>
        <label className={label}>الدولة *
          <input required name="destinationCountry" defaultValue={offer?.destinationCountry ?? ""} maxLength={60} placeholder="تركيا" className={field} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className={label}>الدولة بالإنجليزية *
          <input required name="destinationCountryEn" dir="ltr" defaultValue={offer?.destinationCountryEn ?? ""} maxLength={60} placeholder="Turkey" className={`${field} text-left`} />
        </label>
        <label className={label}>السعر *
          <input required name="priceAmount" type="number" min={100} max={1000000} defaultValue={offer?.priceAmount ?? ""} className={`${field} tnum`} />
        </label>
        <label className={label}>العملة *
          <select name="currency" className={field} defaultValue={offer?.currency ?? "SAR"}>
            {["SAR", "AED", "USD", "EGP", "EUR"].map((currency) => <option key={currency}>{currency}</option>)}
          </select>
        </label>
        <label className={label}>أساس السعر *
          <select name="priceType" className={field} defaultValue={offer?.priceType ?? "per_person"}>
            <option value="per_person">للفرد</option>
            <option value="per_group">للمجموعة</option>
            <option value="starting_from">يبدأ من</option>
          </select>
        </label>
        <label className={label}>عدد الأيام
          <input name="durationDays" type="number" min={1} max={45} defaultValue={offer?.durationDays ?? ""} placeholder="7" className={`${field} tnum`} />
        </label>
        <label className={label}>الحد الأقصى للمسافرين *
          <input required name="maxTravelers" type="number" min={1} max={50} defaultValue={offer?.maxTravelers ?? 8} className={`${field} tnum`} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>المشمولات — بند في كل سطر *
          <textarea required name="includes" defaultValue={offer?.includes.join("\n") ?? ""} rows={4} placeholder="الإقامة\nالإفطار\nالانتقالات" className={`${field} resize-y`} />
        </label>
        <label className={label}>المستثنيات — بند في كل سطر
          <textarea name="excludes" defaultValue={offer?.excludes.join("\n") ?? ""} rows={4} placeholder="الطيران الدولي\nالتأمين" className={`${field} resize-y`} />
        </label>
      </div>

      {error && <p className="rounded-lg bg-errorbg px-4 py-3 text-[13px] font-semibold text-error" role="alert">{error}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-deep px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-horizon disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep focus-visible:ring-offset-2"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : isResubmit ? <PencilLine className="h-4 w-4" aria-hidden="true" /> : <PlusCircle className="h-4 w-4" aria-hidden="true" />}
          {busy ? "جاري الإرسال…" : isResubmit ? "حفظ وإعادة الإرسال للمراجعة" : "إرسال للمراجعة"}
        </button>
        <p className="text-[12px] leading-6 text-slate">لن يظهر العرض للمسافرين إلا بعد اعتماد فريق المراجعة.</p>
      </div>
    </form>
  );
}

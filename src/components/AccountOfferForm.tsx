"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, PlusCircle, X } from "lucide-react";
import { scoreOfferClarity } from "@/lib/offer-clarity";
import { SilaReviewIcon, SilaSparkIcon } from "@/components/brand/SilaIcons";
import { TRIP_TYPES } from "@/lib/format";
import { accountAction } from "@/lib/account-action";

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
      const result = await accountAction(
        "/api/ai/offer-draft",
        {
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
        },
        "تعذّر تشغيل مساعد الوضوح",
      );

      const title = form.elements.namedItem("title");
      const description = form.elements.namedItem("description");
      if (
        title instanceof HTMLInputElement &&
        typeof result.suggestedTitle === "string"
      ) {
        title.value = result.suggestedTitle;
      }
      if (
        description instanceof HTMLTextAreaElement &&
        typeof result.suggestedDescription === "string"
      ) {
        description.value = result.suggestedDescription;
      }

      setAssistMissing(Array.isArray(result.missing) ? result.missing : []);
      setAssistNote(
        typeof result.note === "string"
          ? result.note
          : "تم اقتراح صياغة أوضح من نفس معلوماتك. راجعها قبل الإرسال.",
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
    const lines = (v: string) =>
      v
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);

    try {
      const data = await accountAction(
        "/api/offers",
        {
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
        },
        "تعذّر الإرسال",
      );
      if (data.status !== "pending_review")
        throw new Error(
          "تعذر تأكيد حالة العرض. حدّث الصفحة قبل المحاولة مجددًا.",
        );
      setDone(
        typeof data.message === "string" ? data.message : "عرضك قيد المراجعة.",
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الإرسال");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "min-h-[50px] w-full rounded-xl border border-outlinev bg-cloud px-4 py-3 text-[14px] font-medium text-inkwell outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-slate/50 hover:border-sky focus:border-signal focus:bg-white focus:ring-4 focus:ring-sky/20";

  if (done) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-outlinev bg-air p-6 text-center"
      >
        <CheckCircle2
          className="mx-auto h-8 w-8 text-signal"
          strokeWidth={1.5}
        />
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
        className="sila-motion-safe inline-flex min-h-[52px] items-center gap-2 rounded-xl bg-signal px-5 py-3 text-sm font-bold text-white transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:bg-horizon hover:shadow-[0_10px_26px_rgba(46,111,216,.16)]"
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
      className="space-y-6 overflow-hidden rounded-[1.6rem] border border-outlinev border-t-signal/50 bg-cloud p-5 shadow-[0_14px_46px_rgba(8,38,74,0.06)] md:p-7"
    >
      <div className="flex items-start justify-between gap-4 border-b border-outlinev pb-5">
        <div className="max-w-2xl">
          <div className="sila-eyebrow text-[11px] font-semibold text-signal">
            عرض أوضح قبل المراجعة
          </div>
          <h3 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-inkwell">
            ابنِ العرض كمعلومة قابلة للمقارنة، مش كإعلان.
          </h3>
          <p className="mt-2 text-[12px] leading-6 text-slate">
            السعر، المسار، المشمولات والاستثناءات لازم يتشافوا كقرار واحد قبل ما العرض يدخل المراجعة.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="إغلاق"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate hover:bg-low hover:text-inkwell"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="border-y border-sky/35 bg-air/35 px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[12px] font-bold text-deep">
              مؤشر وضوح العرض
            </div>
            <div className="mt-1 text-[11px] leading-5 text-slate">
              يقيس اكتمال المعلومات فقط — لا يعني التوثيق، ولا يَعِد بمبيعات
              أكثر.
            </div>
          </div>
          <div className="text-end">
            <div className="tnum text-2xl font-bold text-deep">
              {clarity.score}%
            </div>
            <div className="text-[11px] font-semibold text-signal">
              {clarity.label}
            </div>
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
                item.done
                  ? "bg-verifiedbg text-verified"
                  : "bg-cloud text-slate"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${item.done ? "bg-verified" : "bg-outlinev"}`}
              />
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

      <label className="block text-sm font-semibold text-deep">
        عنوان العرض
        <input
          required
          name="title"
          placeholder="عنوان واضح يصف الرحلة…"
          minLength={10}
          maxLength={160}
          className={`${field} mt-2`}
        />
      </label>
      <label className="block text-sm font-semibold text-deep">
        العنوان بالإنجليزية (اختياري)
        <input
          name="titleEn"
          dir="ltr"
          maxLength={160}
          className={`${field} mt-2 text-left`}
        />
      </label>
      <label className="block text-sm font-semibold text-deep">
        وصف البرنامج
        <textarea
          required
          name="description"
          rows={4}
          minLength={60}
          maxLength={4000}
          placeholder="البرنامج والخدمات والحدود، في 60 حرفًا على الأقل…"
          className={`${field} mt-2 resize-y`}
        />
      </label>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="text-sm font-semibold text-deep">
          <label htmlFor="offer-trip-type">نوع الرحلة</label>
          <select
            id="offer-trip-type"
            name="tripType"
            className={`${field} mt-2`}
            defaultValue="package"
          >
            {TRIP_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <label className="text-sm font-semibold text-deep">
          مدينة الانطلاق
          <input
            required
            name="originCity"
            maxLength={60}
            className={`${field} mt-2`}
          />
        </label>
        <label className="text-sm font-semibold text-deep">
          مدينة الوجهة
          <input
            required
            name="destinationCity"
            maxLength={60}
            className={`${field} mt-2`}
          />
        </label>
        <label className="text-sm font-semibold text-deep">
          دولة الوجهة
          <input
            required
            name="destinationCountry"
            maxLength={60}
            className={`${field} mt-2`}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <label className="text-sm font-semibold text-deep">
          دولة الوجهة بالإنجليزية
          <input
            required
            name="destinationCountryEn"
            dir="ltr"
            maxLength={60}
            className={`${field} mt-2 text-left`}
          />
        </label>
        <label className="text-sm font-semibold text-deep">
          السعر
          <input
            required
            name="priceAmount"
            type="number"
            inputMode="numeric"
            min={100}
            max={1000000}
            step={1}
            className={`${field} mt-2 tnum`}
          />
        </label>
        <div className="text-sm font-semibold text-deep">
          <label htmlFor="offer-currency">العملة</label>
          <select
            id="offer-currency"
            name="currency"
            className={`${field} mt-2`}
            defaultValue="SAR"
          >
            {["SAR", "AED", "USD", "EGP", "EUR"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="text-sm font-semibold text-deep">
          <label htmlFor="offer-price-type">أساس السعر</label>
          <select
            id="offer-price-type"
            name="priceType"
            className={`${field} mt-2`}
            defaultValue="per_person"
          >
            <option value="per_person">للفرد</option>
            <option value="per_group">للمجموعة</option>
            <option value="starting_from">يبدأ من</option>
          </select>
        </div>
        <label className="text-sm font-semibold text-deep">
          عدد الأيام (اختياري)
          <input
            name="durationDays"
            type="number"
            inputMode="numeric"
            min={1}
            max={45}
            step={1}
            className={`${field} mt-2 tnum`}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-deep">
          المشمولات
          <textarea
            required
            name="includes"
            rows={3}
            placeholder="سطر لكل خدمة مشمولة…"
            className={`${field} mt-2 resize-y`}
          />
        </label>
        <label className="text-sm font-semibold text-deep">
          المستثنيات (اختياري)
          <textarea
            name="excludes"
            rows={3}
            placeholder="سطر لكل خدمة غير مشمولة…"
            className={`${field} mt-2 resize-y`}
          />
        </label>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-errorbg px-4 py-3 text-[13px] font-semibold text-error"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="sila-motion-safe inline-flex min-h-[52px] items-center gap-2 rounded-xl bg-signal px-6 py-3.5 text-sm font-bold text-white transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:bg-horizon hover:shadow-[0_10px_26px_rgba(46,111,216,.16)] disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SilaReviewIcon className="h-4 w-4" />
          )}
          إرسال للمراجعة
        </button>
        <p className="text-[12px] leading-relaxed text-slate">
          الهدف هنا ليس “تجميل” العرض؛ الهدف أن يفهم المسافر السعر والمشمولات
          والحدود قبل أن يتواصل.
        </p>
      </div>
    </form>
  );
}

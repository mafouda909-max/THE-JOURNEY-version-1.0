"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Circle, Loader2, PlusCircle, X } from "lucide-react";
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
      v.split("\n").map((item) => item.trim()).filter(Boolean);

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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "");
    const lines = (text: string) =>
      text.split("\n").map((item) => item.trim()).filter(Boolean);

    try {
      const data = await accountAction(
        "/api/offers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: value("title"),
            titleEn: value("titleEn"),
            description: value("description"),
            tripType: value("tripType"),
            originCity: value("originCity"),
            destinationCity: value("destinationCity"),
            destinationCountry: value("destinationCountry"),
            destinationCountryEn: value("destinationCountryEn"),
            priceAmount: Number(value("priceAmount")),
            currency: value("currency"),
            priceType: value("priceType"),
            durationDays: value("durationDays") ? Number(value("durationDays")) : null,
            maxTravelers: Number(value("maxTravelers") || 8),
            includes: lines(value("includes")),
            excludes: lines(value("excludes")),
          }),
        },
        "تعذّر الإرسال",
      );

      if (data.status !== "pending_review") {
        throw new Error("تعذر تأكيد حالة العرض. حدّث الصفحة قبل المحاولة مجددًا.");
      }

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
    "min-h-[50px] w-full rounded-xl border border-outlinev bg-cloud px-4 py-3 text-[14px] font-medium text-inkwell outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-slate/50 focus:border-signal focus:bg-white focus:ring-4 focus:ring-air";
  const label = "mb-2 block text-[11px] font-bold text-deep";

  if (done) {
    return (
      <div role="status" className="border-y border-verified/20 bg-verifiedbg/35 px-5 py-7 text-center">
        <CheckCircle2 className="mx-auto h-7 w-7 text-verified" />
        <p className="mt-3 font-bold text-deep">وصل العرض لطابور المراجعة.</p>
        <p className="mt-2 text-sm text-slate">{done}</p>
        <button
          type="button"
          onClick={() => setDone(null)}
          className="quiet-action mt-4"
        >
          إنشاء عرض آخر
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="focus-action">
        <PlusCircle className="h-4 w-4" />
        أنشئ ملف عرض جديد
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
      className="decision-board"
    >
      <header className="flex items-start justify-between gap-4 border-b border-outlinev p-5 md:p-7">
        <div className="max-w-2xl">
          <div className="sila-eyebrow text-[11px] font-bold">Offer dossier</div>
          <h3 className="mt-4 text-2xl font-bold tracking-[-0.025em] text-deep md:text-3xl">
            اكتب العرض كمعلومة قابلة للمقارنة، مش كإعلان.
          </h3>
          <p className="mt-3 text-[12px] leading-6 text-slate">
            المسافر لازم يفهم المسار والسعر والمشمولات والمستثنيات قبل التواصل. الإرسال هنا يبدأ المراجعة ولا ينشر تلقائيًا.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="إغلاق"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-outlinev text-slate hover:bg-low hover:text-deep"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="grid gap-0 lg:grid-cols-[1fr_260px]">
        <div className="p-5 md:p-7">
          <fieldset>
            <legend className="text-[11px] font-bold text-signal">01 · ماذا تعرض؟</legend>
            <div className="mt-4 grid gap-4">
              <label>
                <span className={label}>عنوان وصفي</span>
                <input
                  required
                  name="title"
                  placeholder="مثال: 7 أيام في إسطنبول تشمل فندق 4 نجوم وانتقالات"
                  minLength={10}
                  maxLength={160}
                  className={field}
                />
              </label>

              <label>
                <span className={label}>وصف البرنامج والحدود</span>
                <textarea
                  required
                  name="description"
                  rows={5}
                  minLength={60}
                  maxLength={4000}
                  placeholder="اشرح البرنامج والخدمات والشروط المهمة بدون وعود غير مثبتة…"
                  className={`${field} resize-y`}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="mt-8 border-t border-outlinev pt-6">
            <legend className="px-2 text-[11px] font-bold text-signal">02 · المسار والسعر</legend>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label>
                <span className={label}>مدينة الانطلاق</span>
                <input required name="originCity" maxLength={60} className={field} />
              </label>
              <label>
                <span className={label}>مدينة الوجهة</span>
                <input required name="destinationCity" maxLength={60} className={field} />
              </label>
              <label>
                <span className={label}>دولة الوجهة</span>
                <input required name="destinationCountry" maxLength={60} className={field} />
              </label>
              <label>
                <span className={label}>الدولة بالإنجليزية</span>
                <input required name="destinationCountryEn" dir="ltr" maxLength={60} className={`${field} text-left`} />
              </label>
              <label>
                <span className={label}>السعر</span>
                <input required name="priceAmount" type="number" inputMode="numeric" min={100} max={1000000} step={1} className={`${field} tnum`} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className={label}>العملة</span>
                  <select name="currency" className={field} defaultValue="SAR">
                    {["SAR", "AED", "USD", "EGP", "EUR"].map((currency) => <option key={currency}>{currency}</option>)}
                  </select>
                </label>
                <label>
                  <span className={label}>أساس السعر</span>
                  <select name="priceType" className={field} defaultValue="per_person">
                    <option value="per_person">للفرد</option>
                    <option value="per_group">للمجموعة</option>
                    <option value="starting_from">يبدأ من</option>
                  </select>
                </label>
              </div>
            </div>
          </fieldset>

          <fieldset className="mt-8 border-t border-outlinev pt-6">
            <legend className="px-2 text-[11px] font-bold text-signal">03 · ما الذي يدخل في السعر؟</legend>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label>
                <span className={label}>المشمولات</span>
                <textarea
                  required
                  name="includes"
                  rows={4}
                  placeholder="سطر لكل خدمة مشمولة…"
                  className={`${field} resize-y`}
                />
              </label>
              <label>
                <span className={label}>المستثنيات</span>
                <textarea
                  name="excludes"
                  rows={4}
                  placeholder="سطر لكل خدمة غير مشمولة…"
                  className={`${field} resize-y`}
                />
              </label>
            </div>
          </fieldset>

          <details className="progressive-panel mt-7">
            <summary>تفاصيل إضافية للعرض</summary>
            <div className="grid gap-4 border-t border-outlinev py-5 sm:grid-cols-2 lg:grid-cols-4">
              <label>
                <span className={label}>نوع الرحلة</span>
                <select name="tripType" className={field} defaultValue="package">
                  {TRIP_TYPES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                </select>
              </label>
              <label>
                <span className={label}>عدد الأيام</span>
                <input name="durationDays" type="number" inputMode="numeric" min={1} max={45} step={1} className={`${field} tnum`} />
              </label>
              <label>
                <span className={label}>أقصى عدد مسافرين</span>
                <input name="maxTravelers" type="number" inputMode="numeric" min={1} max={50} step={1} defaultValue={8} className={`${field} tnum`} />
              </label>
              <label>
                <span className={label}>العنوان بالإنجليزية</span>
                <input name="titleEn" dir="ltr" maxLength={160} className={`${field} text-left`} />
              </label>
            </div>
          </details>

          {error ? (
            <p role="alert" className="mt-6 border-y border-error/20 bg-errorbg px-4 py-3 text-[13px] font-semibold text-error">
              {error}
            </p>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-outlinev pt-6">
            <button type="submit" disabled={busy} className="focus-action disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SilaReviewIcon className="h-4 w-4" />}
              إرسال للمراجعة
            </button>
            <p className="max-w-md text-[11px] leading-5 text-slate">
              الإرسال لا يعني النشر. العرض يظل في دورة المراجعة حتى تتغير حالته من النظام.
            </p>
          </div>
        </div>

        <aside className="border-t border-outlinev bg-low/40 p-5 lg:border-s lg:border-t-0 md:p-6">
          <div className="text-[10px] font-bold text-slate">قبل الإرسال</div>
          <div className="mt-4 space-y-3">
            {clarity.checks.map((item) => (
              <div key={item.key} className="grid grid-cols-[20px_1fr] gap-2">
                {item.done ? (
                  <Check className="mt-0.5 h-4 w-4 text-verified" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 text-slate" />
                )}
                <span className={`text-[11px] leading-5 ${item.done ? "font-bold text-deep" : "text-slate"}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-outlinev pt-5">
            <div className="text-[10px] font-bold text-slate">مساعد الصياغة</div>
            <p className="mt-2 text-[11px] leading-5 text-slate">
              يعيد صياغة ما أدخلته فقط. لا يضيف سعرًا، خدمة، شرطًا، أو حقيقة غير موجودة في النموذج.
            </p>
            <button
              type="button"
              onClick={() => void assistDraft()}
              disabled={assistBusy}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-outlinev bg-cloud px-3 py-2 text-[11px] font-bold text-signal disabled:opacity-50"
            >
              {assistBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SilaSparkIcon className="h-4 w-4" />}
              {assistBusy ? "يراجع الصياغة…" : "وضّح صياغتي"}
            </button>
            {assistNote ? (
              <div className="mt-3 text-[10px] leading-5 text-slate">
                <div className="font-bold text-deep">{assistNote}</div>
                {assistMissing.length ? <div className="mt-1">ما زال يحتاج: {assistMissing.join(" · ")}</div> : null}
              </div>
            ) : null}
          </div>

          <div className="mt-6 border-t border-outlinev pt-5">
            <div className="text-[10px] font-bold text-slate">وضوح ≠ توثيق</div>
            <p className="mt-2 text-[11px] leading-5 text-slate">
              اكتمال الحقول يعني أن المسافر يستطيع فهم العرض بشكل أفضل؛ لا يعني أن السعر متاح أو أن صلة ضمنت الخدمة.
            </p>
          </div>
        </aside>
      </div>
    </form>
  );
}

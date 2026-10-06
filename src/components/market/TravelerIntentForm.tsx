"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function TravelerIntentForm({
  initialDestination = "",
  initialLabel = "",
}: {
  initialDestination?: string;
  initialLabel?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setState("saving");
    setError(null);
    const data = new FormData(form);
    const destination = String(data.get("destination") ?? "").trim();

    try {
      const response = await fetch("/api/traveler/intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: String(data.get("label") ?? ""),
          intent: {
            originCity: String(data.get("originCity") ?? "").trim() || null,
            destinations: destination ? [destination] : [],
            departureDate: String(data.get("departureDate") ?? "") || null,
            returnDate: String(data.get("returnDate") ?? "") || null,
            flexibilityDays: Number(data.get("flexibilityDays") ?? 0),
            travelers: {
              adults: Number(data.get("adults") ?? 1),
              children: Number(data.get("children") ?? 0),
              infants: Number(data.get("infants") ?? 0),
            },
            budgetAmountMinor: null,
            budgetCurrency: null,
            budgetBasis: null,
            tripType: null,
            priorities: [],
            constraints: [],
            notes: String(data.get("notes") ?? "").trim() || null,
          },
        }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "تعذر حفظ الرحلة");

      form.reset();
      setState("idle");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ الرحلة");
      setState("error");
    }
  }

  const field =
    "min-h-[50px] w-full rounded-xl border border-outlinev bg-cloud px-3.5 py-3 text-sm font-medium text-inkwell outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-slate/50 focus:border-signal focus:bg-white focus:ring-4 focus:ring-sky/20";
  const label = "mb-2 block text-[11px] font-bold text-deep";

  return (
    <form onSubmit={submit}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="sila-eyebrow text-[11px] font-semibold text-signal">رحلة محفوظة</div>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-inkwell">
            احفظ السياق قبل ما تبدأ تقارن.
          </h2>
          <p className="mt-2 max-w-2xl text-[12px] leading-6 text-slate">
            مش لازم تكون كل التفاصيل جاهزة. الوجهة هي المعلومة الوحيدة المطلوبة الآن.
          </p>
        </div>
        <div className="hidden text-left sm:block">
          <div className="text-[10px] font-bold text-signal">1</div>
          <div className="mt-1 text-[10px] text-slate">سياق واحد لكل رحلة</div>
        </div>
      </div>

      <fieldset className="mt-6">
        <legend className="mb-3 text-[11px] font-bold text-slate">المسار</legend>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="intent-label" className={label}>اسم الرحلة <span className="font-normal text-slate">اختياري</span></label>
            <input
              id="intent-label"
              name="label"
              maxLength={120}
              defaultValue={initialLabel}
              placeholder="مثال: تركيا في نوفمبر"
              className={field}
            />
          </div>

          <div>
            <label htmlFor="intent-origin" className={label}>مدينة الانطلاق <span className="font-normal text-slate">اختياري</span></label>
            <input
              id="intent-origin"
              name="originCity"
              placeholder="مثال: القاهرة"
              className={field}
            />
          </div>

          <div>
            <label htmlFor="intent-destination" className={label}>الوجهة</label>
            <input
              id="intent-destination"
              name="destination"
              required
              defaultValue={initialDestination}
              placeholder="مثال: إسطنبول"
              className={field}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="mt-6 border-t border-outlinev pt-5">
        <legend className="px-2 text-[11px] font-bold text-slate">التوقيت</legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="intent-departure" className={label}>الذهاب <span className="font-normal text-slate">لو تعرفه</span></label>
            <input id="intent-departure" name="departureDate" type="date" className={field} />
          </div>
          <div>
            <label htmlFor="intent-return" className={label}>العودة <span className="font-normal text-slate">لو تعرفها</span></label>
            <input id="intent-return" name="returnDate" type="date" className={field} />
          </div>
        </div>
      </fieldset>

      <fieldset className="mt-6 border-t border-outlinev pt-5">
        <legend className="px-2 text-[11px] font-bold text-slate">المسافرون</legend>
        <div className="mt-2 grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="intent-adults" className={label}>بالغون</label>
            <input id="intent-adults" name="adults" type="number" min={1} max={40} defaultValue={1} inputMode="numeric" className={`${field} tnum`} />
          </div>
          <div>
            <label htmlFor="intent-children" className={label}>أطفال</label>
            <input id="intent-children" name="children" type="number" min={0} max={40} defaultValue={0} inputMode="numeric" className={`${field} tnum`} />
          </div>
          <div>
            <label htmlFor="intent-infants" className={label}>رضّع</label>
            <input id="intent-infants" name="infants" type="number" min={0} max={20} defaultValue={0} inputMode="numeric" className={`${field} tnum`} />
          </div>
        </div>
      </fieldset>

      <details className="sila-progressive mt-6">
        <summary>تفاصيل إضافية — لو لها تأثير على القرار</summary>
        <div className="grid gap-4 p-4 sm:grid-cols-[180px_1fr]">
          <div>
            <label htmlFor="intent-flexibility" className={label}>مرونة المواعيد</label>
            <div className="relative">
              <input
                id="intent-flexibility"
                name="flexibilityDays"
                type="number"
                min={0}
                max={30}
                defaultValue={0}
                inputMode="numeric"
                className={`${field} tnum`}
              />
              <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[11px] text-slate">يوم</span>
            </div>
          </div>
          <div>
            <label htmlFor="intent-notes" className={label}>قيد أو ملاحظة مهمة</label>
            <textarea
              id="intent-notes"
              name="notes"
              maxLength={4000}
              rows={3}
              placeholder="مثال: طفل صغير، ترانزيت قصير، ميزانية محددة…"
              className={`${field} resize-none`}
            />
          </div>
        </div>
      </details>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-errorbg p-3 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-outlinev pt-5">
        <button
          type="submit"
          disabled={state === "saving"}
          className="sila-attention-primary min-w-[170px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "saving" ? "بنحفظ الرحلة…" : "احفظ الرحلة"}
        </button>
        <p className="max-w-md text-[11px] leading-5 text-slate">
          الحفظ لا يرسل طلبًا لأي وكيل. أنت فقط بتثبت سياق الرحلة عشان ما تبدأش من الصفر كل مرة.
        </p>
      </div>
    </form>
  );
}

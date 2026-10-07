"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

function FieldLabel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-bold text-deep">{title}</span>
        {hint ? <span className="text-[10px] text-slate">{hint}</span> : null}
      </span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

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
      if (!response.ok) throw new Error(json.error ?? "تعذر حفظ نية السفر");

      form.reset();
      setState("idle");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ نية السفر");
      setState("error");
    }
  }

  const field =
    "min-h-[52px] w-full rounded-xl border border-outlinev bg-cloud px-3.5 py-3 text-sm font-semibold text-inkwell outline-none transition-[border-color,box-shadow,background-color] focus:border-signal focus:ring-4 focus:ring-air";

  return (
    <form onSubmit={submit} className="decision-board">
      <div className="border-b border-outlinev p-5 md:p-6">
        <div className="sila-eyebrow text-[11px] font-bold">Saved Intent</div>
        <h2 className="mt-3 text-2xl font-bold tracking-[-0.025em] text-deep">
          احفظ السياق، مش كل التفاصيل.
        </h2>
        <p className="mt-2 max-w-[620px] text-[12px] leading-6 text-slate">
          يكفي اسم الرحلة والوجهة الآن. باقي التفاصيل تساعد صلة تفهم السياق،
          لكن تقدر تضيفها لاحقًا بدون ما تبدأ من جديد.
        </p>
      </div>

      <div className="p-5 md:p-6">
        <fieldset>
          <legend className="text-[11px] font-bold text-signal">المسار الأساسي</legend>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <FieldLabel title="اسم الرحلة" hint="اختياري">
              <input
                name="label"
                maxLength={120}
                defaultValue={initialLabel}
                placeholder="مثال: تركيا في ديسمبر"
                className={field}
              />
            </FieldLabel>

            <FieldLabel title="مدينة الانطلاق" hint="اختياري">
              <input
                name="originCity"
                placeholder="مثال: القاهرة"
                className={field}
              />
            </FieldLabel>

            <div className="md:col-span-2">
              <FieldLabel title="الوجهة">
                <input
                  name="destination"
                  required
                  defaultValue={initialDestination}
                  placeholder="مثال: إسطنبول"
                  className={field}
                />
              </FieldLabel>
            </div>
          </div>
        </fieldset>

        <fieldset className="mt-6 border-t border-outlinev pt-6">
          <legend className="px-2 text-[11px] font-bold text-signal">التوقيت والمسافرون</legend>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <FieldLabel title="تاريخ المغادرة" hint="اختياري">
              <input name="departureDate" type="date" className={field} />
            </FieldLabel>

            <FieldLabel title="تاريخ العودة" hint="اختياري">
              <input name="returnDate" type="date" className={field} />
            </FieldLabel>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <FieldLabel title="البالغون">
              <input
                name="adults"
                type="number"
                min={1}
                max={40}
                defaultValue={1}
                aria-label="البالغون"
                className={field}
              />
            </FieldLabel>
            <FieldLabel title="الأطفال">
              <input
                name="children"
                type="number"
                min={0}
                max={40}
                defaultValue={0}
                aria-label="الأطفال"
                className={field}
              />
            </FieldLabel>
            <FieldLabel title="الرضع">
              <input
                name="infants"
                type="number"
                min={0}
                max={20}
                defaultValue={0}
                aria-label="الرضع"
                className={field}
              />
            </FieldLabel>
          </div>
        </fieldset>

        <details className="progressive-panel mt-6">
          <summary>تفاصيل إضافية لتحسين السياق</summary>
          <div className="grid gap-4 border-t border-outlinev py-5 md:grid-cols-[180px_1fr]">
            <FieldLabel title="مرونة الأيام">
              <input
                name="flexibilityDays"
                type="number"
                min={0}
                max={30}
                defaultValue={0}
                className={field}
              />
            </FieldLabel>

            <FieldLabel title="ملاحظات أو قيود مهمة" hint="اختياري">
              <textarea
                name="notes"
                maxLength={4000}
                rows={4}
                placeholder="مثال: أفضل رحلة صباحية أو عندي ترانزيت لازم أتأكد منه"
                className={`${field} min-h-28 resize-none`}
              />
            </FieldLabel>
          </div>
        </details>

        {error ? (
          <p role="alert" className="mt-4 border-y border-error/20 bg-errorbg px-4 py-3 text-sm font-semibold text-error">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-outlinev pt-5">
          <button
            type="submit"
            disabled={state === "saving"}
            className="focus-action min-h-[52px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state === "saving" ? "جارٍ الحفظ…" : "احفظ نية السفر"}
          </button>
          <p className="max-w-md text-[11px] leading-5 text-slate">
            الحفظ لا يرسل طلبًا لوكيل ولا يبدأ حجزًا؛ هو فقط يحافظ على سياق رحلتك.
          </p>
        </div>
      </div>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function TravelerIntentForm({ initialDestination = "", initialLabel = "" }: { initialDestination?: string; initialLabel?: string }) {
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

  const field = "w-full rounded-xl border border-outlinev bg-low/60 px-3 py-3 text-sm font-semibold text-inkwell outline-none focus:border-signal";

  return (
    <form onSubmit={submit} className="sila-window border border-outlinev bg-cloud p-5">
      <div className="sila-eyebrow text-[11px] font-semibold text-signal">Saved Intent</div>
      <h2 className="mt-2 text-xl font-bold text-inkwell">احفظ نية السفر قبل ما تبدأ المقارنة.</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <input name="label" maxLength={120} defaultValue={initialLabel} placeholder="اسم مختصر للرحلة" className={field} />
        <input name="originCity" placeholder="مدينة الانطلاق" className={field} />
        <input name="destination" required defaultValue={initialDestination} placeholder="الوجهة *" className={field} />
        <input name="departureDate" type="date" className={field} />
        <input name="returnDate" type="date" className={field} />
        <input name="flexibilityDays" type="number" min={0} max={30} defaultValue={0} placeholder="مرونة الأيام" className={field} />
        <input name="adults" type="number" min={1} max={40} defaultValue={1} aria-label="البالغون" className={field} />
        <input name="children" type="number" min={0} max={40} defaultValue={0} aria-label="الأطفال" className={field} />
        <input name="infants" type="number" min={0} max={20} defaultValue={0} aria-label="الرضع" className={field} />
      </div>
      <textarea name="notes" maxLength={4000} rows={3} placeholder="ملاحظات أو قيود مهمة" className={`${field} mt-3 resize-none`} />
      {error ? <p className="mt-3 rounded-xl bg-errorbg p-3 text-sm font-semibold text-error">{error}</p> : null}
      <button
        type="submit"
        disabled={state === "saving"}
        className="mt-4 rounded-xl bg-signal px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {state === "saving" ? "جارٍ الحفظ…" : "احفظ نية السفر"}
      </button>
    </form>
  );
}

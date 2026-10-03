"use client";

import Link from "next/link";
import { useState } from "react";

export function IntentOfferSave({
  offerId,
  intents,
}: {
  offerId: number;
  intents: Array<{ id: number; label: string }>;
}) {
  const [intentId, setIntentId] = useState(intents[0]?.id ?? 0);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (intents.length === 0) {
    return (
      <Link
        href="/account/travel"
        className="inline-flex w-full items-center justify-center rounded-2xl border border-outlinev bg-low px-4 py-3 text-[13px] font-bold text-deep hover:border-sky"
      >
        أنشئ نية سفر لحفظ هذا العرض للمقارنة
      </Link>
    );
  }

  async function save() {
    setState("saving");
    setError(null);
    try {
      const response = await fetch(`/api/traveler/intents/${intentId}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "تعذر حفظ العرض");
      setState("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ العرض");
      setState("error");
    }
  }

  return (
    <div className="rounded-2xl border border-outlinev bg-low/60 p-3">
      <div className="text-[11px] font-semibold text-slate">حفظ للمقارنة داخل نية سفر</div>
      <div className="mt-2 flex gap-2">
        <select
          value={intentId}
          onChange={(event) => {
            setIntentId(Number(event.target.value));
            setState("idle");
          }}
          className="min-w-0 flex-1 rounded-xl border border-outlinev bg-cloud px-3 py-2 text-[12px] font-semibold text-deep"
        >
          {intents.map((intent) => (
            <option key={intent.id} value={intent.id}>{intent.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={state === "saving"}
          className="rounded-xl bg-deep px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
        >
          {state === "saving" ? "جارٍ الحفظ…" : state === "saved" ? "تم الحفظ" : "احفظ"}
        </button>
      </div>
      {error ? <p className="mt-2 text-[11px] font-semibold text-error">{error}</p> : null}
    </div>
  );
}

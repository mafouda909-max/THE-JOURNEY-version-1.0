"use client";

import Link from "next/link";
import { useState } from "react";

export function SaveOfferToIntentButton({
  intentId,
  offerId,
}: {
  intentId: number;
  offerId: number;
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setState("saving");
    setMessage(null);
    try {
      const response = await fetch(`/api/traveler/intents/${intentId}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "تعذر حفظ العرض");
      setState("saved");
      setMessage("تم حفظ العرض في مقارنة هذه الرحلة.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "تعذر حفظ العرض");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void save()}
        disabled={state === "saving" || state === "saved"}
        className="rounded-xl bg-air px-4 py-2.5 text-[12px] font-bold text-deep disabled:opacity-60"
      >
        {state === "saving" ? "جارٍ الحفظ…" : state === "saved" ? "محفوظ للمقارنة" : "احفظ للمقارنة"}
      </button>
      <Link href="/account/travel" className="text-[12px] font-bold text-signal hover:underline">
        مساحة رحلتي
      </Link>
      {message ? (
        <span className={state === "error" ? "text-[11px] text-error" : "text-[11px] text-verified"}>
          {message}
        </span>
      ) : null}
    </div>
  );
}

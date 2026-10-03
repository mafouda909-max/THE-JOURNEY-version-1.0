"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

export function ShareOfferButton({
  offerId,
  title,
  compact = false,
}: {
  offerId: number;
  title: string;
  compact?: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "shared">("idle");

  async function track(channel: string) {
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "offer_shared",
          offerId,
          meta: `channel=${channel}`,
        }),
      });
    } catch {
      // Growth telemetry must never block sharing.
    }
  }

  async function share() {
    const url = new URL(`/offers/${offerId}`, window.location.origin);
    url.searchParams.set("utm_source", "agent_share");
    url.searchParams.set("utm_medium", "share");
    url.searchParams.set("utm_campaign", `offer_${offerId}`);

    const payload = {
      title,
      text: `شوف تفاصيل «${title}» على صلة قبل ما تتواصل.`,
      url: url.toString(),
    };

    if (navigator.share) {
      try {
        await navigator.share(payload);
        setState("shared");
        void track("native");
        window.setTimeout(() => setState("idle"), 2200);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(payload.url);
      setState("copied");
      void track("clipboard");
      window.setTimeout(() => setState("idle"), 2200);
    } catch {
      setState("idle");
    }
  }

  const label =
    state === "copied"
      ? "تم نسخ الرابط"
      : state === "shared"
        ? "تمت المشاركة"
        : compact
          ? "مشاركة"
          : "شارك العرض الموثوق";

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <button
      type="button"
      onClick={() => void share()}
      className={
        compact
          ? "sila-interactive inline-flex items-center gap-1.5 rounded-xl border border-outlinev bg-cloud px-3 py-2 text-[12px] font-bold text-deep hover:border-sky hover:text-signal"
          : "sila-interactive inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-outlinev bg-cloud px-4 py-2.5 text-[13px] font-bold text-deep hover:border-sky hover:bg-air/40 hover:text-signal"
      }
      aria-live="polite"
    >
      {state === "copied" || state === "shared" ? (
        <Check className="h-4 w-4" />
      ) : canNativeShare ? (
        <Share2 className="h-4 w-4" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {label}
    </button>
  );
}

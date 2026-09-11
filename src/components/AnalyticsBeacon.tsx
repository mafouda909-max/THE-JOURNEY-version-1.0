"use client";

import { useEffect } from "react";
import type { EventName } from "@/lib/data";

const VISIBLE_DWELL_MS = 2_000;

function eventMeta() {
  const params = new URLSearchParams(window.location.search);
  const payload: Record<string, string> = { source: "client_visible_2000ms" };
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const) {
    const value = params.get(key)?.trim();
    if (value) payload[key] = value.slice(0, 80);
  }
  const referrer = document.referrer;
  if (referrer) {
    try {
      const url = new URL(referrer);
      if (url.origin !== window.location.origin) payload.referrer = url.hostname.slice(0, 120);
    } catch {
      // Invalid referrer text is ignored.
    }
  }
  return JSON.stringify(payload);
}

export function AnalyticsBeacon({
  name,
  offerId,
  agentId,
}: {
  name: EventName;
  offerId?: number;
  agentId?: number;
}) {
  useEffect(() => {
    if (navigator.webdriver) return;

    const controller = new AbortController();
    let timer: number | null = null;
    let sent = false;

    const clear = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = () => {
      clear();
      if (sent || document.visibilityState !== "visible") return;
      timer = window.setTimeout(() => {
        if (sent || document.visibilityState !== "visible") return;
        sent = true;
        void fetch("/api/events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, offerId, agentId, meta: eventMeta() }),
          keepalive: true,
          signal: controller.signal,
        }).catch(() => undefined);
      }, VISIBLE_DWELL_MS);
    };

    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      document.removeEventListener("visibilitychange", schedule);
      clear();
      controller.abort();
    };
  }, [name, offerId, agentId]);

  return null;
}

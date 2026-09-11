"use client";

import { useEffect } from "react";
import type { EventName } from "@/lib/data";

function campaignMeta() {
  const params = new URLSearchParams(window.location.search);
  const payload: Record<string, string> = {};
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
  return Object.keys(payload).length ? JSON.stringify(payload) : undefined;
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
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, offerId, agentId, meta: campaignMeta() }),
        keepalive: true,
        signal: controller.signal,
      }).catch(() => undefined);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [name, offerId, agentId]);

  return null;
}

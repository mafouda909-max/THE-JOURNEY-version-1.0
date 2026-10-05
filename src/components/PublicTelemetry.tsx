"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { publicTelemetryEvent } from "@/lib/public-telemetry";

export function PublicTelemetry() {
  return <><Analytics beforeSend={publicTelemetryEvent} /><SpeedInsights beforeSend={publicTelemetryEvent} /></>;
}

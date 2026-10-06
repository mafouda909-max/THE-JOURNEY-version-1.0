import { NextResponse } from "next/server";
import { reviewSilaOfferIntelligence, type SilaOfferReviewInput } from "@/lib/sila-offer-intelligence";
import { planSilaMissionControl } from "@/lib/sila-mission-control";
import { resolveSilaAiRuntimeGateFromEnv } from "@/lib/sila-ai-runtime-gate";

export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const offer: SilaOfferReviewInput = {
    status: typeof payload.status === "string" ? payload.status : "pending_review",
    title: typeof payload.title === "string" ? payload.title : "",
    priceAmount: typeof payload.priceAmount === "number" ? payload.priceAmount : Number(payload.priceAmount ?? 0),
    currency: typeof payload.currency === "string" ? payload.currency : "",
    originCity: typeof payload.originCity === "string" ? payload.originCity : "",
    destinationCity: typeof payload.destinationCity === "string" ? payload.destinationCity : "",
    destinationCountry: typeof payload.destinationCountry === "string" ? payload.destinationCountry : "",
    includes: stringArray(payload.includes),
    excludes: stringArray(payload.excludes),
    expiresAt: parseDate(payload.expiresAt),
    departureDate: parseDate(payload.departureDate),
    publishedAt: parseDate(payload.publishedAt),
    lastAgentConfirmationAt: parseDate(payload.lastAgentConfirmationAt),
    hasVerifiedAgent: payload.hasVerifiedAgent === true,
    hasCurrentAgentTrust: payload.hasCurrentAgentTrust === true,
    hasPriceEvidence: payload.hasPriceEvidence === true,
    hasSourceEvidence: payload.hasSourceEvidence === true,
  };

  const review = reviewSilaOfferIntelligence(offer);
  const mission = planSilaMissionControl({
    offers: [offer],
    aiRuntime: resolveSilaAiRuntimeGateFromEnv(),
  });

  return NextResponse.json({
    review,
    tasks: mission.tasks,
    commandSummary: mission.commandSummary,
    safety: {
      doNotPublishIfExpired: true,
      doNotRecommendWithoutInventory: true,
      needsEvidenceBeforeFeaturedPlacement: true,
    },
  });
}

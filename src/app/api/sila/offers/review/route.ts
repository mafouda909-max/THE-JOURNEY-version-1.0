import { NextResponse } from "next/server";
import { reviewSilaOfferIntelligence, type SilaOfferReviewInput, type SilaOfferSourceEvidence } from "@/lib/sila-offer-intelligence";
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

function sourceEvidenceFromPayload(payload: Record<string, unknown>): SilaOfferSourceEvidence[] {
  const explicit = payload.sourceEvidence;
  if (Array.isArray(explicit)) {
    return explicit.flatMap((item): SilaOfferSourceEvidence[] => {
      if (!item || typeof item !== "object") return [];
      const source = item as Record<string, unknown>;
      const label = typeof source.label === "string" ? source.label.trim() : "";
      const kind = typeof source.kind === "string" ? source.kind : "";
      if (!label || !["agent_statement", "official", "inventory", "price", "availability", "internal"].includes(kind)) {
        return [];
      }
      return [{
        label,
        kind: kind as SilaOfferSourceEvidence["kind"],
        url: typeof source.url === "string" ? source.url : null,
        checkedAt: parseDate(source.checkedAt),
      }];
    });
  }

  const evidence: SilaOfferSourceEvidence[] = [];
  const confirmedAt = parseDate(payload.lastAgentConfirmationAt) ?? parseDate(payload.lastConfirmedAt);
  if (payload.hasSourceEvidence === true) {
    evidence.push({ label: "مصدر عرض مرفق", kind: "internal", checkedAt: confirmedAt });
  }
  if (payload.hasPriceEvidence === true) {
    evidence.push({ label: "دليل سعر مرفق", kind: "price", checkedAt: confirmedAt });
  }
  if (confirmedAt || payload.hasAgentConfirmation === true) {
    evidence.push({ label: "تأكيد وكيل", kind: "agent_statement", checkedAt: confirmedAt });
  }
  return evidence;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const lastConfirmedAt = parseDate(payload.lastConfirmedAt) ?? parseDate(payload.lastAgentConfirmationAt);
  const hasVerifiedAgent = payload.hasVerifiedAgent === true;
  const offer: SilaOfferReviewInput = {
    id: typeof payload.id === "string" || typeof payload.id === "number" ? payload.id : null,
    status: typeof payload.status === "string" ? payload.status : "pending_review",
    title: typeof payload.title === "string" ? payload.title : "",
    description: typeof payload.description === "string" ? payload.description : "",
    tripType: typeof payload.tripType === "string" ? payload.tripType : "package",
    priceAmount: typeof payload.priceAmount === "number" ? payload.priceAmount : Number(payload.priceAmount ?? 0),
    currency: typeof payload.currency === "string" ? payload.currency : "",
    priceType: typeof payload.priceType === "string" ? payload.priceType : null,
    originCity: typeof payload.originCity === "string" ? payload.originCity : "",
    destinationCity: typeof payload.destinationCity === "string" ? payload.destinationCity : "",
    destinationCountry: typeof payload.destinationCountry === "string" ? payload.destinationCountry : "",
    includes: stringArray(payload.includes),
    excludes: stringArray(payload.excludes),
    expiresAt: parseDate(payload.expiresAt),
    departureDate: parseDate(payload.departureDate),
    publishedAt: parseDate(payload.publishedAt),
    lastConfirmedAt,
    agentVerificationStatus: hasVerifiedAgent ? "verified" : typeof payload.agentVerificationStatus === "string" ? payload.agentVerificationStatus : null,
    agentTrustCurrent: payload.hasCurrentAgentTrust === true || payload.agentTrustCurrent === true,
    sourceEvidence: sourceEvidenceFromPayload(payload),
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

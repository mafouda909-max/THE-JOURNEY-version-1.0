import { NextResponse } from "next/server";
import { createSilaTravelCase, mergeSilaTravelCaseMessage, parseSilaTravelCase } from "@/lib/sila-advisor-travel-case";
import { resolveSilaAiRuntimeGateFromEnv } from "@/lib/sila-ai-runtime-gate";
import { planSilaMissionControl } from "@/lib/sila-mission-control";
import { resolveSilaRuntimeStatus } from "@/lib/sila-runtime-status";
import { renderSilaLiveAdvisor } from "@/lib/sila-live-advisor";

export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
  const runtimeStatus = resolveSilaRuntimeStatus();
  const mission = planSilaMissionControl({ aiRuntime: runtimeStatus.aiRuntime });

  return NextResponse.json({
    service: "sila-advisor-runtime",
    aiRuntime: runtimeStatus.aiRuntime,
    runtimeStatus,
    commandSummary: mission.commandSummary,
    tasks: mission.tasks,
    note: "POST a natural message to build a Sila file and receive advisor mission control output.",
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (message.length < 3) {
    return badRequest("message is required and must be at least 3 characters.");
  }

  const incomingCase =
    typeof payload.case === "string"
      ? parseSilaTravelCase(payload.case)
      : typeof payload.serializedCase === "string"
        ? parseSilaTravelCase(payload.serializedCase)
        : null;

  const silaCase = incomingCase
    ? mergeSilaTravelCaseMessage(incomingCase, message)
    : createSilaTravelCase(message);

  const runtimeStatus = resolveSilaRuntimeStatus();
  const aiRuntime = resolveSilaAiRuntimeGateFromEnv();
  const mission = planSilaMissionControl({ travelCase: silaCase, aiRuntime });
  const advisorResponse = mission.advisorBrain
    ? await renderSilaLiveAdvisor({
        brain: mission.advisorBrain,
        evidenceReview: mission.evidenceReview,
        runtimeStatus,
        signal: request.signal,
      })
    : null;

  return NextResponse.json({
    case: silaCase,
    aiRuntime,
    runtimeStatus,
    advisorBrain: mission.advisorBrain,
    advisorResponse,
    evidenceReview: mission.evidenceReview,
    offerReviews: mission.offerReviews,
    tasks: mission.tasks,
    commandSummary: mission.commandSummary,
    safety: {
      liveAiActive: advisorResponse?.status === "AI_DRAFT",
      liveAiAvailable: runtimeStatus.canDraftWithAi,
      paidAiAllowed: runtimeStatus.canUsePaidAi,
      backgroundCallsAllowed: runtimeStatus.canRunBackgroundCalls,
      noFakeSources: true,
      noFakeOffers: true,
      offerRecommendationsRequireInventory: true,
    },
  });
}

import { NextResponse } from "next/server";
import { createSilaTravelCase, mergeSilaTravelCaseMessage, parseSilaTravelCase } from "@/lib/sila-advisor-travel-case";
import { resolveSilaAiRuntimeGateFromEnv } from "@/lib/sila-ai-runtime-gate";
import { planSilaMissionControl } from "@/lib/sila-mission-control";

export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
  const aiRuntime = resolveSilaAiRuntimeGateFromEnv();
  const mission = planSilaMissionControl({ aiRuntime });

  return NextResponse.json({
    service: "sila-advisor-runtime",
    aiRuntime,
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

  const aiRuntime = resolveSilaAiRuntimeGateFromEnv();
  const mission = planSilaMissionControl({ travelCase: silaCase, aiRuntime });

  return NextResponse.json({
    case: silaCase,
    aiRuntime,
    advisorBrain: mission.advisorBrain,
    offerReviews: mission.offerReviews,
    tasks: mission.tasks,
    commandSummary: mission.commandSummary,
    safety: {
      liveAiActive: aiRuntime.canCallModel,
      noFakeSources: true,
      noFakeOffers: true,
      offerRecommendationsRequireInventory: true,
    },
  });
}

import { NextResponse } from "next/server";
import { accountFromRequest, requireAccount } from "@/lib/identity";
import {
  clearOwnedSilaAdvisorMemory,
  loadOwnedSilaAdvisorMemory,
  persistOwnedSilaAdvisorMemory,
} from "@/lib/sila-advisor-memory-store";
import { parseSilaTravelCase } from "@/lib/sila-advisor-travel-case";

export const dynamic = "force-dynamic";

function unavailable() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

function parseIntentId(value: unknown): number | null {
  const numberValue = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;
  return Number.isSafeInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

async function travelerAccount(request: Request) {
  const account = await accountFromRequest(request);
  return { account, denied: requireAccount(account, ["traveler"]) };
}

export async function GET(request: Request) {
  if (process.env.TRAVELER_WORKSPACE_ENABLED !== "true") return unavailable();

  const { account, denied } = await travelerAccount(request);
  if (denied) return denied;

  const intentId = parseIntentId(new URL(request.url).searchParams.get("intentId"));
  if (!intentId) {
    return NextResponse.json({ error: "intentId is required." }, { status: 400 });
  }

  const memory = await loadOwnedSilaAdvisorMemory(intentId, account!.id);
  if (!memory) return unavailable();

  return NextResponse.json(
    { memory },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(request: Request) {
  if (process.env.TRAVELER_WORKSPACE_ENABLED !== "true") return unavailable();

  const { account, denied } = await travelerAccount(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const intentId = parseIntentId(payload.intentId);
  if (!intentId) {
    return NextResponse.json({ error: "intentId is required." }, { status: 400 });
  }

  const serializedCase = typeof payload.case === "string"
    ? payload.case
    : payload.case && typeof payload.case === "object"
      ? JSON.stringify(payload.case)
      : null;
  const travelCase = parseSilaTravelCase(serializedCase);
  if (!travelCase) {
    return NextResponse.json({ error: "A valid Sila travel case is required." }, { status: 422 });
  }

  const memory = await persistOwnedSilaAdvisorMemory({
    intentId,
    accountId: account!.id,
    travelCase,
  });
  if (!memory) return unavailable();

  return NextResponse.json(
    {
      memory: {
        intentId: memory.intentId,
        label: memory.label,
        updatedAt: memory.travelCase?.updatedAt ?? null,
        messageCount: memory.travelCase?.messages.length ?? 0,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  if (process.env.TRAVELER_WORKSPACE_ENABLED !== "true") return unavailable();

  const { account, denied } = await travelerAccount(request);
  if (denied) return denied;

  const intentId = parseIntentId(new URL(request.url).searchParams.get("intentId"));
  if (!intentId) {
    return NextResponse.json({ error: "intentId is required." }, { status: 400 });
  }

  const cleared = await clearOwnedSilaAdvisorMemory(intentId, account!.id);
  if (!cleared) return unavailable();

  return NextResponse.json(
    { cleared: true, intentId },
    { headers: { "Cache-Control": "no-store" } },
  );
}

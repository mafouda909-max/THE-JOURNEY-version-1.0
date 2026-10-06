import { NextResponse } from "next/server";
import {
  analyzeSilaGeminiContext,
  resolveSilaGeminiContextRuntime,
  type SilaContextDataClass,
} from "@/lib/sila-gemini-context";

export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
  const runtime = resolveSilaGeminiContextRuntime();
  return NextResponse.json({
    service: "sila-gemini-context",
    runtime,
    note:
      "هذا العامل لتحليل محتوى عام/منقح فقط. بيانات المسافر الحساسة محجوبة افتراضيًا.",
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
  const text = typeof payload.text === "string" ? payload.text : "";
  const task = typeof payload.task === "string" ? payload.task : "";
  const sourceLabel = typeof payload.sourceLabel === "string" ? payload.sourceLabel : null;
  const dataClass =
    payload.dataClass === "PUBLIC" ||
    payload.dataClass === "REDACTED" ||
    payload.dataClass === "SENSITIVE"
      ? (payload.dataClass as SilaContextDataClass)
      : null;

  if (!dataClass) return badRequest("dataClass must be PUBLIC, REDACTED, or SENSITIVE.");
  if (text.trim().length < 10) return badRequest("text must be at least 10 characters.");
  if (task.trim().length < 3) return badRequest("task is required.");

  const result = await analyzeSilaGeminiContext(
    { text, task, dataClass, sourceLabel },
  );

  if (result.status === "BLOCKED") {
    return NextResponse.json(result, { status: 422 });
  }
  if (result.status === "NOT_CONFIGURED") {
    return NextResponse.json(result, { status: 503 });
  }
  return NextResponse.json(result);
}

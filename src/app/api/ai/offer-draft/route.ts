import { NextResponse } from "next/server";
import { accountFromRequest } from "@/lib/identity";
import { aiProvider } from "@/lib/provider-gateway";
import { readAuthBody } from "@/lib/auth-request";
import { guardCapabilityRequest } from "@/lib/capability-request";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const account = await accountFromRequest(request);
  if (!account || account.role !== "agent") {
    return NextResponse.json(
      { error: "مساعد صياغة العروض متاح لحسابات الوكلاء فقط." },
      { status: 401 },
    );
  }
  const denied = guardCapabilityRequest(request, "ai_draft", account.id);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await readAuthBody(request, 16000);
  } catch (error) {
    return NextResponse.json({ error: "بيانات الطلب غير صالحة." }, { status: error instanceof RangeError ? 413 : 400, headers: { "Cache-Control": "private, no-store" } });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const text = (key: string, max = 4000) =>
    typeof b[key] === "string" ? String(b[key]).trim().slice(0, max) : "";

  const draft = {
    title: text("title", 180),
    description: text("description"),
    originCity: text("originCity", 80),
    destinationCity: text("destinationCity", 80),
    destinationCountry: text("destinationCountry", 80),
    priceAmount: Number(b.priceAmount ?? 0),
    currency: text("currency", 8),
    priceType: text("priceType", 32),
    durationDays: Number(b.durationDays ?? 0),
    includes: Array.isArray(b.includes)
      ? b.includes.filter((x): x is string => typeof x === "string").slice(0, 12).map((x) => x.trim().slice(0, 400))
      : [],
    excludes: Array.isArray(b.excludes)
      ? b.excludes.filter((x): x is string => typeof x === "string").slice(0, 12).map((x) => x.trim().slice(0, 400))
      : [],
  };

  if (!draft.title && !draft.description) {
    return NextResponse.json(
      { error: "اكتب عنواناً أو وصفاً أولاً حتى نساعدك في توضيحه." },
      { status: 422 },
    );
  }

  const result = await aiProvider.assistOfferDraft(draft);
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}

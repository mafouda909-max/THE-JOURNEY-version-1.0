import { NextResponse } from "next/server";
import { publicServiceProgress } from "@/lib/service-fulfillment";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const result = await publicServiceProgress((await context.params).token);
    return NextResponse.json(result.body, { status: result.status, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
  } catch {
    return NextResponse.json({ error: "تعذر تحميل متابعة الخدمة." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

import { NextResponse } from "next/server";
import { probeTravelerMemoryRuntime } from "@/lib/traveler-memory-runtime";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "public, max-age=0, no-store" };

export async function GET() {
  const result = await probeTravelerMemoryRuntime();
  return NextResponse.json(result, {
    status: result.status === "READY" ? 200 : 503,
    headers: NO_STORE,
  });
}

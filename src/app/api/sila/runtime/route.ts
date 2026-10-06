import { NextResponse } from "next/server";
import { resolveSilaRuntimeStatus } from "@/lib/sila-runtime-status";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(resolveSilaRuntimeStatus());
}

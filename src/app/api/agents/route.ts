import { NextResponse } from "next/server";
import { getAgentsWithRatings } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await getAgentsWithRatings();
  return NextResponse.json({ count: rows.length, agents: rows });
}

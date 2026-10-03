import { NextResponse } from "next/server";
import { getAgentsWithRatings } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const agents = await getAgentsWithRatings();
  return NextResponse.json({ count: agents.length, agents });
}

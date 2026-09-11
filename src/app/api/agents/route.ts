import { NextResponse } from "next/server";
import { getAgentsWithRatings } from "@/lib/data";
import { toPublicAgent } from "@/lib/public-agent";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await getAgentsWithRatings();
  const publicAgents = rows.map(toPublicAgent);
  return NextResponse.json({ count: publicAgents.length, agents: publicAgents });
}

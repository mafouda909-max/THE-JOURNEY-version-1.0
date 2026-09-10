import { POST as verificationPost } from "../route";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
// Preserve this endpoint as an alias of the same ownership and evidence boundary.
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  return verificationPost(new Request(request.url, {
    method: "POST", headers: request.headers,
    body: JSON.stringify({ documentId: (body as { documentId?: unknown } | null)?.documentId, action: "confirm" }),
  }));
}

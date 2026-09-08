import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { offers } from "@/db/schema";
import { accountFromRequest } from "@/lib/identity";
import { createScopedUploadUrl, listMedia, r2Configured } from "@/lib/r2";
import { MAX_MEDIA_BYTES, MEDIA_TYPES, mediaPrefix } from "@/lib/media-policy";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
async function scope(request: Request, input: Record<string, unknown>) {
  const account = await accountFromRequest(request);
  if (!account)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (account.role !== "agent" || !account.agentId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const resource = input.resource;
  const offerId = Number(input.offerId);
  if (resource === "offer") {
    if (!Number.isSafeInteger(offerId) || offerId < 1)
      return NextResponse.json({ error: "Invalid offer" }, { status: 422 });
    const [offer] = await db
      .select({ id: offers.id })
      .from(offers)
      .where(and(eq(offers.id, offerId), eq(offers.agentId, account.agentId)))
      .limit(1);
    if (!offer)
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  } else if (resource !== "profile") {
    return NextResponse.json(
      { error: "resource must be profile or offer" },
      { status: 422 },
    );
  }
  if (!r2Configured)
    return NextResponse.json(
      { error: "Storage not configured" },
      { status: 503 },
    );
  return mediaPrefix(account.agentId, resource, offerId);
}
export async function GET(request: Request) {
  const prefix = await scope(
    request,
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (typeof prefix !== "string") return prefix;
  try {
    const objects = await listMedia(prefix);
    return NextResponse.json(
      { count: objects.length, objects },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 502 });
  }
}
export async function POST(request: Request) {
  if (!(await accountFromRequest(request)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!input || typeof input !== "object")
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const prefix = await scope(request, input);
  if (typeof prefix !== "string") return prefix;
  const { filename, contentType, contentLength } = input;
  if (
    typeof filename !== "string" ||
    !filename.trim() ||
    filename.length > 200 ||
    typeof contentType !== "string" ||
    !MEDIA_TYPES.has(contentType) ||
    typeof contentLength !== "number" ||
    !Number.isSafeInteger(contentLength) ||
    contentLength < 1 ||
    contentLength > MAX_MEDIA_BYTES
  ) {
    return NextResponse.json(
      {
        error:
          "Use JPEG, PNG or WebP up to 10 MB with a declared contentLength",
      },
      { status: 422 },
    );
  }
  try {
    return NextResponse.json(
      await createScopedUploadUrl(prefix, filename, contentType, contentLength),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 502 });
  }
}

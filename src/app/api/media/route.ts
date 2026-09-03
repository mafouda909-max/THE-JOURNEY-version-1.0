import { NextResponse } from "next/server";
import {
  R2_BUCKET,
  R2_ENDPOINT,
  createUploadUrl,
  listMedia,
  r2Configured,
  r2MissingVars,
} from "@/lib/r2";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function notConfigured() {
  return NextResponse.json(
    {
      configured: false,
      endpoint: R2_ENDPOINT,
      bucket: R2_BUCKET,
      missing: r2MissingVars.join(", "),
      error:
        "Object store not configured — set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY to enable.",
    },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  if (!r2Configured) return notConfigured();

  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get("prefix") ?? "";

  try {
    const objects = await listMedia(prefix);
    return NextResponse.json({
      configured: true,
      endpoint: R2_ENDPOINT,
      bucket: R2_BUCKET,
      count: objects.length,
      objects,
    });
  } catch (err) {
    return NextResponse.json(
      {
        configured: true,
        bucket: R2_BUCKET,
        error:
          err instanceof Error
            ? `Store unreachable — ${err.message}`
            : "Store unreachable",
      },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  if (!r2Configured) return notConfigured();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { filename, contentType } = (body ?? {}) as Record<string, unknown>;

  if (typeof filename !== "string" || !filename.trim()) {
    return NextResponse.json({ error: "A filename is required." }, { status: 422 });
  }
  if (
    typeof contentType !== "string" ||
    !/^(image|video)\//.test(contentType)
  ) {
    return NextResponse.json(
      { error: "Only image or video files may be uploaded." },
      { status: 422 },
    );
  }

  try {
    const { key, url } = await createUploadUrl(filename.trim(), contentType);
    return NextResponse.json({ key, url, bucket: R2_BUCKET }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not prepare the upload — try again." },
      { status: 502 },
    );
  }
}

import { NextResponse } from "next/server";
import {
  B2_BUCKET_NAME,
  B2_ENDPOINT,
  b2Configured,
  b2MissingVars,
  createUploadUrl,
  listMedia,
} from "@/lib/b2";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function notConfigured() {
  return NextResponse.json(
    {
      configured: false,
      endpoint: B2_ENDPOINT,
      bucket: B2_BUCKET_NAME,
      missing: b2MissingVars.join(", "),
      error: "Object store not configured — set the B2_* storage environment variables to enable.",
    },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  if (!b2Configured) return notConfigured();

  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get("prefix") ?? "";

  try {
    const objects = await listMedia(prefix);
    return NextResponse.json({
      configured: true,
      endpoint: B2_ENDPOINT,
      bucket: B2_BUCKET_NAME,
      count: objects.length,
      objects,
    });
  } catch (err) {
    return NextResponse.json(
      {
        configured: true,
        bucket: B2_BUCKET_NAME,
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
  if (!b2Configured) return notConfigured();

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
    return NextResponse.json({ key, url, bucket: B2_BUCKET_NAME }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not prepare the upload — try again." },
      { status: 502 },
    );
  }
}

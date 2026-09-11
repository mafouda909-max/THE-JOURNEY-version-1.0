import { NextResponse } from "next/server";
import {
  B2_BUCKET_NAME,
  b2Configured,
  createUploadUrl,
  listMedia,
} from "@/lib/b2";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KYC_PREFIX = "kyc/";

function notConfigured() {
  return NextResponse.json(
    {
      configured: false,
      error: "Object store not configured.",
    },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  if (!b2Configured) return notConfigured();

  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get("prefix") ?? "";

  try {
    const objects = await listMedia(prefix);
    const visibleObjects = prefix === "" || !prefix.startsWith(KYC_PREFIX)
      ? objects.filter((object) => !object.key.startsWith(KYC_PREFIX))
      : objects;

    return NextResponse.json({
      configured: true,
      count: visibleObjects.length,
      objects: visibleObjects,
    });
  } catch {
    return NextResponse.json(
      {
        configured: true,
        error: "Object store is temporarily unavailable.",
      },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
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

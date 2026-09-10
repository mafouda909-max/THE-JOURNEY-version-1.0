import { NextResponse } from "next/server";
import {
  B2_BUCKET_NAME,
  B2_ENDPOINT,
  b2Configured,
  b2MissingVars,
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

  // KYC/KYB objects are never part of the public media listing. Explicit
  // access to that namespace requires the existing fail-closed admin boundary.
  if (prefix === KYC_PREFIX || prefix.startsWith(KYC_PREFIX)) {
    const denied = requireAdmin(request);
    if (denied) return denied;
  }

  try {
    const objects = await listMedia(prefix);
    const visibleObjects = prefix === "" || !prefix.startsWith(KYC_PREFIX)
      ? objects.filter((object) => !object.key.startsWith(KYC_PREFIX))
      : objects;

    return NextResponse.json({
      configured: true,
      endpoint: B2_ENDPOINT,
      bucket: B2_BUCKET_NAME,
      count: visibleObjects.length,
      objects: visibleObjects,
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

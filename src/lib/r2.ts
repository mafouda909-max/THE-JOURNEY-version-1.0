import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { uniqueObjectKey } from "@/lib/media-policy";

/**
 * Cloudflare R2 (S3-compatible) object store for expedition media.
 *
 * Configuration is read from the environment so keys never live in code:
 *   R2_ACCESS_KEY_ID     — required to enable
 *   R2_SECRET_ACCESS_KEY — required to enable
 *   R2_BUCKET            — defaults to "journey-media"
 *   R2_ENDPOINT          — defaults to the atelier account endpoint below
 */
// `||` (not `??`): placeholder stubs inject empty strings, which must
// also fall back to defaults — a half-written config stays sensible.
export const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  "https://2eca4cd5678e4a4436002de07ba17d85.r2.cloudflarestorage.com";

export const R2_BUCKET = process.env.R2_BUCKET || "journey-media";

const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

export const r2Configured = Boolean(accessKeyId && secretAccessKey);

export const r2MissingVars = [
  ...(accessKeyId ? [] : ["R2_ACCESS_KEY_ID"]),
  ...(secretAccessKey ? [] : ["R2_SECRET_ACCESS_KEY"]),
];

const globalForR2 = globalThis as typeof globalThis & {
  __journeyR2Client?: S3Client;
};

function getClient(): S3Client | null {
  if (!r2Configured) return null;
  globalForR2.__journeyR2Client ??= new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: accessKeyId as string,
      secretAccessKey: secretAccessKey as string,
    },
  });
  return globalForR2.__journeyR2Client;
}

export interface R2ObjectInfo {
  key: string;
  size: number;
  lastModified: string | null;
  url: string;
}

export async function createScopedUploadUrl(
  prefix: string,
  filename: string,
  contentType: string,
  contentLength: number,
) {
  const client = getClient();
  if (!client) throw new Error("R2 is not configured");
  const key = uniqueObjectKey(prefix, filename);
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
      IfNoneMatch: "*",
    }),
    {
      expiresIn: 300,
      signableHeaders: new Set([
        "content-type",
        "content-length",
        "if-none-match",
      ]),
    },
  );
  return {
    key,
    url,
    headers: { "Content-Type": contentType, "If-None-Match": "*" },
    expiresInSeconds: 300,
  };
}

export async function privateDownloadUrl(key: string, expiresIn: number) {
  const client = getClient();
  if (!client) throw new Error("R2 is not configured");
  if (!key.startsWith("kyc/") || key.includes(".."))
    throw new Error("Invalid private key");
  if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 900)
    throw new Error("Invalid expiration");
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ResponseContentDisposition: "attachment",
    }),
    { expiresIn },
  );
}

export async function inspectPrivateObject(key: string) {
  const client = getClient();
  if (!client) throw new Error("R2 is not configured");
  const meta = await client.send(
    new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }),
  );
  if (
    !meta.ContentLength ||
    meta.ContentLength > 10 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "application/pdf"].includes(
      meta.ContentType ?? "",
    )
  )
    throw new Error("Invalid document metadata");
  const object = await client.send(
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, Range: "bytes=0-7" }),
  );
  const bytes = Buffer.from(await object.Body!.transformToByteArray());
  const valid =
    meta.ContentType === "application/pdf"
      ? bytes.subarray(0, 5).toString() === "%PDF-"
      : meta.ContentType === "image/png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!valid) throw new Error("Document content does not match type");
  return { contentType: meta.ContentType, contentLength: meta.ContentLength };
}

/** List objects under a prefix with short-lived presigned GET URLs. */
export async function listMedia(
  prefix = "",
  maxKeys = 60,
): Promise<R2ObjectInfo[]> {
  const client = getClient();
  if (!client) throw new Error("R2 is not configured");

  const res = await client.send(
    new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: prefix,
      MaxKeys: maxKeys,
    }),
  );

  const objects = (res.Contents ?? []).filter(
    (o) => o.Key && !o.Key.endsWith("/"),
  );

  return Promise.all(
    objects.map(async (o) => ({
      key: o.Key as string,
      size: o.Size ?? 0,
      lastModified: o.LastModified ? o.LastModified.toISOString() : null,
      url: await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: R2_BUCKET, Key: o.Key }),
        { expiresIn: 900 },
      ),
    })),
  );
}

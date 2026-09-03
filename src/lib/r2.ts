import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

  const objects = (res.Contents ?? []).filter((o) => o.Key && !o.Key.endsWith("/"));

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

/** Create a short-lived presigned PUT URL for a direct browser upload. */
export async function createUploadUrl(
  filename: string,
  contentType: string,
): Promise<{ key: string; url: string }> {
  const client = getClient();
  if (!client) throw new Error("R2 is not configured");

  const safe = filename
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-80);
  const key = `uploads/${Date.now()}-${safe || "file"}`;

  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 600 },
  );

  return { key, url };
}

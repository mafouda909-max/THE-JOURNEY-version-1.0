import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Backblaze B2 object store using its S3-compatible API.
 *
 * Required environment variables:
 *   B2_ENDPOINT         — e.g. https://s3.us-east-005.backblazeb2.com
 *   B2_BUCKET_NAME      — private production bucket
 *   B2_KEY_ID           — bucket-scoped application key ID
 *   B2_APPLICATION_KEY  — bucket-scoped application key secret
 */
export const B2_ENDPOINT = process.env.B2_ENDPOINT || "";
export const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || "";

const keyId = process.env.B2_KEY_ID;
const applicationKey = process.env.B2_APPLICATION_KEY;

export const b2Configured = Boolean(
  B2_ENDPOINT && B2_BUCKET_NAME && keyId && applicationKey,
);

export const b2MissingVars = [
  ...(B2_ENDPOINT ? [] : ["B2_ENDPOINT"]),
  ...(B2_BUCKET_NAME ? [] : ["B2_BUCKET_NAME"]),
  ...(keyId ? [] : ["B2_KEY_ID"]),
  ...(applicationKey ? [] : ["B2_APPLICATION_KEY"]),
];

const globalForB2 = globalThis as typeof globalThis & {
  __journeyB2Client?: S3Client;
};

function getClient(): S3Client | null {
  if (!b2Configured) return null;

  globalForB2.__journeyB2Client ??= new S3Client({
    region: "us-east-005",
    endpoint: B2_ENDPOINT,
    credentials: {
      accessKeyId: keyId as string,
      secretAccessKey: applicationKey as string,
    },
  });

  return globalForB2.__journeyB2Client;
}

export interface B2ObjectInfo {
  key: string;
  size: number;
  lastModified: string | null;
  url: string;
}

/** Return true only when a private object exists in B2. */
export async function privateObjectExists(storageKey: string): Promise<boolean> {
  const client = getClient();
  if (!client) throw new Error("Backblaze B2 is not configured");

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: B2_BUCKET_NAME,
        Key: storageKey,
      }),
    );
    return true;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return false;
    throw error;
  }
}

/** List objects under a prefix with short-lived presigned GET URLs. */
export async function listMedia(
  prefix = "",
  maxKeys = 60,
): Promise<B2ObjectInfo[]> {
  const client = getClient();
  if (!client) throw new Error("Backblaze B2 is not configured");

  const res = await client.send(
    new ListObjectsV2Command({
      Bucket: B2_BUCKET_NAME,
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
        new GetObjectCommand({
          Bucket: B2_BUCKET_NAME,
          Key: o.Key,
        }),
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
  if (!client) throw new Error("Backblaze B2 is not configured");

  const safe = filename
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-80);
  const key = `uploads/${Date.now()}-${safe || "file"}`;

  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: B2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 600 },
  );

  return { key, url };
}

/** Create a short-lived presigned PUT URL for a private KYC/KYB document. */
export async function createPrivateUploadUrl(
  storageKey: string,
  contentType: string,
): Promise<PresignedUploadResult> {
  const client = getClient();
  if (!client) throw new Error("Backblaze B2 is not configured");

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: B2_BUCKET_NAME,
      Key: storageKey,
      ContentType: contentType,
    }),
    { expiresIn: 600 },
  );

  return {
    uploadUrl,
    storageKey,
    expiresInSeconds: 600,
  };
}

/** Create a short-lived presigned GET URL for a private KYC/KYB document. */
export async function createPrivateDownloadUrl(
  storageKey: string,
  expiresInSeconds = 900,
): Promise<PresignedDownloadResult> {
  const client = getClient();
  if (!client) throw new Error("Backblaze B2 is not configured");

  const downloadUrl = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: B2_BUCKET_NAME,
      Key: storageKey,
    }),
    { expiresIn: expiresInSeconds },
  );

  return { downloadUrl, expiresInSeconds };
}

export interface PresignedUploadResult {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

export interface PresignedDownloadResult {
  downloadUrl: string;
  expiresInSeconds: number;
}

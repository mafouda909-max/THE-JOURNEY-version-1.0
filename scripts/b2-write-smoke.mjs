import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "node:crypto";

const required = ["B2_ENDPOINT", "B2_BUCKET_NAME", "B2_KEY_ID", "B2_APPLICATION_KEY"];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) throw new Error(`Missing B2 env: ${missing.join(",")}`);

const endpoint = process.env.B2_ENDPOINT.replace(/\/$/, "");
const bucket = process.env.B2_BUCKET_NAME;
const client = new S3Client({
  region: "us-east-005",
  endpoint,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
});

const key = `release-health/sila-write-read-${Date.now()}-${randomBytes(4).toString("hex")}.txt`;
const body = `sila-b2-smoke:${Date.now()}`;
let uploaded = false;
let deleted = false;

try {
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: "text/plain; charset=utf-8",
  }));
  uploaded = true;

  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (head.ContentLength !== Buffer.byteLength(body)) {
    throw new Error("B2_HEAD_SIZE_MISMATCH");
  }

  const signedUrl = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 60 },
  );
  const signedResponse = await fetch(signedUrl, { cache: "no-store" });
  if (!signedResponse.ok) throw new Error(`B2_SIGNED_GET_${signedResponse.status}`);
  const downloaded = await signedResponse.text();
  if (downloaded !== body) throw new Error("B2_SIGNED_GET_BODY_MISMATCH");

  const plainKey = key.split("/").map(encodeURIComponent).join("/");
  const unsignedResponse = await fetch(`${endpoint}/${bucket}/${plainKey}`, {
    cache: "no-store",
    redirect: "manual",
  });
  if (![401, 403, 404].includes(unsignedResponse.status)) {
    throw new Error(`B2_PRIVATE_ACCESS_UNEXPECTED_${unsignedResponse.status}`);
  }

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  deleted = true;

  console.log("SILA_B2_WRITE_READ_SMOKE_OK", JSON.stringify({
    put: true,
    head: true,
    signedGet: true,
    unsignedStatus: unsignedResponse.status,
    deleted: true,
  }));
} finally {
  if (uploaded && !deleted) {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      console.log("SILA_B2_SMOKE_CLEANUP_OK");
    } catch {
      console.error("SILA_B2_SMOKE_CLEANUP_FAILED");
    }
  }
}

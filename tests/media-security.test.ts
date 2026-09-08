import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mediaPrefix,
  uniqueObjectKey,
  MEDIA_TYPES,
} from "../src/lib/media-policy";
import { GET, POST } from "../src/app/api/media/route";
import { PrivateStorageProvider } from "../src/lib/storage";

test("unauthenticated media requests refuse before touching database or storage", async () => {
  assert.equal(
    (await GET(new Request("https://example.test/api/media?prefix=kyc/")))
      .status,
    401,
  );
  assert.equal(
    (
      await POST(
        new Request("https://example.test/api/media", {
          method: "POST",
          body: "bad json",
        }),
      )
    ).status,
    401,
  );
});
test("media namespaces cannot be selected by a prefix or cross-owner identifier", () => {
  assert.equal(mediaPrefix(1, "profile"), "media/agents/1/profile/");
  assert.notEqual(mediaPrefix(1, "offer", 1), mediaPrefix(2, "offer", 1));
  for (const resource of ["kyc", "../profile", "", "media/agents/2/"])
    assert.throws(() => mediaPrefix(1, resource));
  assert.throws(() => mediaPrefix(-1, "profile"));
  assert.throws(() => mediaPrefix(1, "offer", NaN));
  assert.equal(MEDIA_TYPES.has("image/svg+xml"), false);
});
test("keys are unique even for simultaneous identical filenames and stay in namespace", () => {
  const prefix = mediaPrefix(1, "profile");
  const keys = Array.from({ length: 100 }, () =>
    uniqueObjectKey(prefix, "../../evil<script>.jpg"),
  );
  assert.equal(new Set(keys).size, 100);
  for (const key of keys) {
    assert.equal(key.startsWith(prefix), true);
    assert.equal(key.slice(prefix.length).includes("/"), false);
  }
});
test("unconfigured private storage never fabricates a signed URL", async () => {
  if (process.env.R2_ACCESS_KEY_ID || process.env.R2_SECRET_ACCESS_KEY)
    throw new Error("Run unit tests without R2 credentials");
  await assert.rejects(
    new PrivateStorageProvider().getPresignedDownloadUrl(
      "kyc/agent_1/passport/file",
    ),
    /not configured/,
  );
});

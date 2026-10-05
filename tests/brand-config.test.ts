import assert from "node:assert/strict";
import test from "node:test";
import { resolvePublicEmail, resolvePublicSiteUrl } from "../src/lib/brand";

test("public site URL ignores empty and invalid environment values", () => {
  assert.equal(resolvePublicSiteUrl("", undefined), "https://the-journey-version-1-0.vercel.app");
  assert.equal(resolvePublicSiteUrl("not-a-url"), "https://the-journey-version-1-0.vercel.app");
  assert.equal(resolvePublicSiteUrl("ftp://example.com"), "https://the-journey-version-1-0.vercel.app");
  assert.equal(resolvePublicSiteUrl(" https://example.com/path?q=1 "), "https://example.com");
});

test("public email fails closed for empty or malformed environment values", () => {
  assert.equal(resolvePublicEmail(""), null);
  assert.equal(resolvePublicEmail("not-an-email"), null);
  assert.equal(resolvePublicEmail(" hello@example.com "), "hello@example.com");
});

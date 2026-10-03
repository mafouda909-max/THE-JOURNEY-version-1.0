import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { isCommunityEnabled } from "../src/lib/community";

test("community is fail-closed unless explicitly enabled", () => {
  const previous = process.env.COMMUNITY_ENABLED;
  delete process.env.COMMUNITY_ENABLED;
  assert.equal(isCommunityEnabled(), false);

  process.env.COMMUNITY_ENABLED = "true";
  assert.equal(isCommunityEnabled(), true);

  if (previous === undefined) delete process.env.COMMUNITY_ENABLED;
  else process.env.COMMUNITY_ENABLED = previous;
});

test("community migration is additive and creates all v1 tables", () => {
  const sql = fs.readFileSync("db/community_v1.sql", "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS community_posts/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS community_comments/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS community_reactions/i);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|DELETE FROM/i);
});

test("community page avoids DB reads while feature is disabled", () => {
  const page = fs.readFileSync("src/app/community/page.tsx", "utf8");
  assert.match(page, /const posts = enabled \? await listPublishedCommunityPosts/);
});

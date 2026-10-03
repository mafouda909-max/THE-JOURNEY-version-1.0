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

test("community release wiring is present for clean and existing databases", () => {
  const manifest = JSON.parse(fs.readFileSync("db/release_manifest.json", "utf8")) as {
    existingDatabaseMigrations: string[];
  };
  const base = fs.readFileSync("db/production_schema.sql", "utf8");
  const rollback = fs.readFileSync("db/community_v1_rollback.sql", "utf8");
  const productionCheck = fs.readFileSync("scripts/check-production-schema.ts", "utf8");

  assert.ok(manifest.existingDatabaseMigrations.includes("db/community_v1.sql"));
  assert.match(base, /CREATE TABLE IF NOT EXISTS community_posts/i);
  assert.match(base, /CREATE TABLE IF NOT EXISTS community_comments/i);
  assert.match(base, /CREATE TABLE IF NOT EXISTS community_reactions/i);
  assert.match(productionCheck, /community_posts/);
  assert.match(productionCheck, /community_comments/);
  assert.match(productionCheck, /community_reactions/);
  assert.match(rollback, /DROP TABLE IF EXISTS community_reactions/i);
  assert.doesNotMatch(manifest.existingDatabaseMigrations.join("\n"), /rollback/i);
});

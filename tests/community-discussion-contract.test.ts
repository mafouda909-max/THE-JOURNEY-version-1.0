import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("community reply migration is additive and ordered after Community v1", () => {
  const migration = read("db/community_comments_replies_v2.sql");
  const manifest = JSON.parse(read("db/release_manifest.json")) as {
    schemaVersion: number;
    existingDatabaseMigrations: string[];
  };
  const v1 = manifest.existingDatabaseMigrations.indexOf("db/community_v1.sql");
  const v2 = manifest.existingDatabaseMigrations.indexOf("db/community_comments_replies_v2.sql");

  assert.match(migration, /ADD COLUMN IF NOT EXISTS parent_comment_id/i);
  assert.match(migration, /REFERENCES community_comments\(id\) ON DELETE CASCADE/i);
  assert.match(migration, /community_comments_parent_idx/i);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
  assert.ok(v1 >= 0 && v2 > v1);
  assert.equal(manifest.schemaVersion, 13);
});

test("fresh schema and production read-only contract include the reply relationship", () => {
  assert.match(read("src/db/schema.ts"), /parentCommentId: integer\("parent_comment_id"\)/);
  assert.match(read("db/production_schema.sql"), /parent_comment_id INTEGER REFERENCES community_comments\(id\)/i);
  assert.match(read("db/production_schema.sql"), /community_comments_parent_idx/i);
  assert.match(read("scripts/check-production-schema.ts"), /community_comments: \[.*parent_comment_id/);
});

test("public discussion writes are authenticated and moderator decisions are protected", () => {
  const comments = read("src/app/api/community/posts/[id]/comments/route.ts");
  const moderation = read("src/app/api/community/comments/[id]/route.ts");

  assert.match(comments, /isCommunityEnabled/);
  assert.match(comments, /accountFromRequest/);
  assert.match(comments, /status: "pending_review"/);
  assert.match(comments, /parentCommentId/);
  assert.match(comments, /rateLimiter\.checkRateLimit/);
  assert.match(moderation, /requireAdmin/);
  assert.match(moderation, /community_comment_/);
  assert.match(moderation, /commentCount/);
});

test("community cards expose discussions and a protected moderator queue exists", () => {
  const page = read("src/app/community/page.tsx");
  const discussion = read("src/components/community/CommunityDiscussion.tsx");
  const moderatorPage = read("src/app/trust/community/page.tsx");

  assert.match(page, /CommunityDiscussion/);
  assert.match(discussion, /\/api\/community\/posts\//);
  assert.match(discussion, /parentCommentId/);
  assert.match(moderatorPage, /isAdminSession/);
  assert.match(moderatorPage, /listPendingCommunityComments/);
});

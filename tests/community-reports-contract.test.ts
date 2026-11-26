import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("community report migration creates private, scoped reports without destructive changes", () => {
  const migration = read("db/community_reports_v3.sql");
  const manifest = JSON.parse(read("db/release_manifest.json")) as {
    schemaVersion: number;
    existingDatabaseMigrations: string[];
  };
  const replies = manifest.existingDatabaseMigrations.indexOf("db/community_comments_replies_v2.sql");
  const reports = manifest.existingDatabaseMigrations.indexOf("db/community_reports_v3.sql");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS community_reports/);
  assert.match(migration, /reporter_account_id INTEGER NOT NULL REFERENCES accounts\(id\)/);
  assert.match(migration, /community_reports_post_reporter_uidx/);
  assert.match(migration, /community_reports_comment_reporter_uidx/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
  assert.ok(replies >= 0 && reports > replies);
  assert.equal(manifest.schemaVersion, 13);
});

test("report submission is authenticated, rate-limited, target-scoped and feature-gated", () => {
  const route = read("src/app/api/community/reports/route.ts");
  const button = read("src/components/community/CommunityReportButton.tsx");

  assert.match(route, /isCommunityEnabled/);
  assert.match(route, /accountFromRequest/);
  assert.match(route, /rateLimiter\.checkRateLimit/);
  assert.match(route, /onConflictDoNothing/);
  assert.match(route, /community_content_reported/);
  assert.match(button, /\/api\/community\/reports/);
  assert.match(button, /targetType/);
});

test("only administrators can resolve or dismiss private reports", () => {
  const route = read("src/app/api/community/reports/[id]/route.ts");
  const page = read("src/app/trust/community/page.tsx");
  const helper = read("src/lib/community.ts");

  assert.match(route, /requireAdmin/);
  assert.match(route, /pending_review/);
  assert.match(route, /reviewedAt/);
  assert.match(route, /community_report_/);
  assert.match(page, /isAdminSession/);
  assert.match(page, /CommunityReportQueue/);
  assert.match(helper, /listPendingCommunityReports/);
});

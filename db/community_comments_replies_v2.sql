-- SILA Community discussions v2
-- Additive-only migration. Run after db/community_v1.sql.
-- Existing top-level comments remain valid with parent_comment_id = NULL.
-- Apply only after backup and the normal release approval process.

BEGIN;

ALTER TABLE community_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER
  REFERENCES community_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS community_comments_parent_idx
  ON community_comments(parent_comment_id, created_at);

UPDATE community_posts AS p
SET comment_count = (
  SELECT COUNT(*)::INTEGER
  FROM community_comments AS c
  WHERE c.post_id = p.id
    AND c.status = 'published'
);

COMMIT;

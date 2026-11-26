-- SILA Community discussions v2 rollback
-- DESTRUCTIVE: removes reply relationships. Owner approval and backup required.
-- Never run automatically.

BEGIN;

DROP INDEX IF EXISTS community_comments_parent_idx;
ALTER TABLE community_comments DROP COLUMN IF EXISTS parent_comment_id;

COMMIT;

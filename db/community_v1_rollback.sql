-- SILA Community v1 rollback
-- DESTRUCTIVE: removes community posts, comments and reactions.
-- Owner approval and backup are required. Never run automatically.

BEGIN;

DROP TABLE IF EXISTS community_reactions;
DROP TABLE IF EXISTS community_comments;
DROP TABLE IF EXISTS community_posts;

COMMIT;

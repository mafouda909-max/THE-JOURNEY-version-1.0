-- SILA Community reports v3
-- Additive-only migration. Run after community comments/replies v2.
-- Reports are private to moderators and never change public visibility by themselves.

BEGIN;

CREATE TABLE IF NOT EXISTS community_reports (
  id SERIAL PRIMARY KEY,
  reporter_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_type VARCHAR(16) NOT NULL,
  post_id INTEGER REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id INTEGER REFERENCES community_comments(id) ON DELETE CASCADE,
  category VARCHAR(24) NOT NULL,
  details TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending_review',
  moderator_note TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT community_reports_target_check CHECK (
    (target_type = 'post' AND post_id IS NOT NULL AND comment_id IS NULL)
    OR
    (target_type = 'comment' AND comment_id IS NOT NULL AND post_id IS NULL)
  ),
  CONSTRAINT community_reports_category_check CHECK (
    category IN ('spam','misinformation','harassment','privacy','unsafe','other')
  ),
  CONSTRAINT community_reports_status_check CHECK (
    status IN ('pending_review','resolved','dismissed')
  ),
  CONSTRAINT community_reports_details_length_check CHECK (
    details IS NULL OR char_length(details) <= 500
  )
);

CREATE INDEX IF NOT EXISTS community_reports_status_created_idx
  ON community_reports(status, created_at);

CREATE INDEX IF NOT EXISTS community_reports_reporter_created_idx
  ON community_reports(reporter_account_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS community_reports_post_reporter_uidx
  ON community_reports(reporter_account_id, post_id)
  WHERE target_type = 'post' AND post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS community_reports_comment_reporter_uidx
  ON community_reports(reporter_account_id, comment_id)
  WHERE target_type = 'comment' AND comment_id IS NOT NULL;

COMMIT;

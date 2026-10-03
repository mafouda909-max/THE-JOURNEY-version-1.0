-- SILA Community v1
-- Additive-only. Apply before setting COMMUNITY_ENABLED=true.
-- No existing marketplace/trust tables are altered.

BEGIN;

CREATE TABLE IF NOT EXISTS community_posts (
  id SERIAL PRIMARY KEY,
  author_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  destination_country VARCHAR(80),
  destination_city VARCHAR(80),
  topic VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'pending_review',
  helpful_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS community_posts_status_created_idx
  ON community_posts(status, created_at);
CREATE INDEX IF NOT EXISTS community_posts_destination_idx
  ON community_posts(destination_country, destination_city);
CREATE INDEX IF NOT EXISTS community_posts_author_idx
  ON community_posts(author_account_id);

CREATE TABLE IF NOT EXISTS community_comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending_review',
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS community_comments_post_idx
  ON community_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS community_comments_status_idx
  ON community_comments(status);

CREATE TABLE IF NOT EXISTS community_reactions (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type VARCHAR(16) NOT NULL DEFAULT 'helpful',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT community_reactions_unique UNIQUE(post_id, account_id, type)
);

CREATE INDEX IF NOT EXISTS community_reactions_post_idx
  ON community_reactions(post_id);

COMMIT;

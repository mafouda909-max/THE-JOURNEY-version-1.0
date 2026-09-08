-- Additive migration. Review actual schema before production use.
-- Rollback: deploy previous app and retain nullable additions; no deletion required.
BEGIN;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_verified_at timestamp;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS phone varchar(20);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS phone_verified_at timestamp;
ALTER TABLE contact_requests ADD COLUMN IF NOT EXISTS traveler_account_id integer REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE contact_requests ADD COLUMN IF NOT EXISTS response text;
ALTER TABLE contact_requests ADD COLUMN IF NOT EXISTS tracking_token_hash varchar(64);
CREATE INDEX IF NOT EXISTS contact_requests_account_idx ON contact_requests(traveler_account_id);
CREATE TABLE IF NOT EXISTS verification_challenges (
  id uuid PRIMARY KEY,
  account_id integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  channel varchar(10) NOT NULL CHECK (channel IN ('email', 'phone')),
  destination text NOT NULL,
  secret_hash varchar(64) NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_challenges_account_idx ON verification_challenges(account_id, created_at);
COMMIT;

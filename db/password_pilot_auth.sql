-- Additive, standalone pilot migration. Never reset accounts or apply the release chain.
BEGIN;
SELECT pg_advisory_xact_lock(746312089);

CREATE UNIQUE INDEX IF NOT EXISTS accounts_normalized_email_uidx ON accounts (lower(email));

CREATE TABLE IF NOT EXISTS auth_password_attempts (
  bucket_key VARCHAR(64) PRIMARY KEY,
  attempts INTEGER NOT NULL CHECK (attempts > 0),
  reset_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_password_attempts_reset_idx ON auth_password_attempts(reset_at);

COMMIT;

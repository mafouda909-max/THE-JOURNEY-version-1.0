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


CREATE TABLE IF NOT EXISTS auth_password_recovery (
  id BIGSERIAL PRIMARY KEY,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  purpose VARCHAR(24) NOT NULL CHECK (purpose IN ('password_reset','email_verify')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS auth_password_recovery_account_idx
  ON auth_password_recovery(account_id, purpose, created_at);
CREATE INDEX IF NOT EXISTS auth_password_recovery_expiry_idx
  ON auth_password_recovery(expires_at);

COMMIT;

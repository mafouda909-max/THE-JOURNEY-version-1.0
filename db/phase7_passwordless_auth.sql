-- SILA Phase 7 — passwordless authentication hardening
-- Additive forward migration. Production execution requires Owner approval.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM linked_identities
     GROUP BY provider, provider_subject
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce unique external identity mapping: duplicate provider subjects exist';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS linked_identities_provider_subject_uidx
  ON linked_identities(provider, provider_subject);

CREATE TABLE IF NOT EXISTS auth_challenges (
  id SERIAL PRIMARY KEY,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(200) NOT NULL,
  requested_role VARCHAR(16) NOT NULL,
  intent VARCHAR(16) NOT NULL,
  purpose VARCHAR(24) NOT NULL,
  display_name TEXT,
  city TEXT,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_challenges_role_check CHECK (requested_role IN ('traveler','agent')),
  CONSTRAINT auth_challenges_intent_check CHECK (intent IN ('login','signup')),
  CONSTRAINT auth_challenges_purpose_check CHECK (purpose IN ('magic_link'))
);

CREATE INDEX IF NOT EXISTS auth_challenges_email_created_idx
  ON auth_challenges(email, created_at);
CREATE INDEX IF NOT EXISTS auth_challenges_expiry_idx
  ON auth_challenges(expires_at);

COMMIT;

-- SILA Phase 7 rollback
-- DESTRUCTIVE FOR PASSWORDLESS CHALLENGES. Owner approval required.
-- Existing linked identity rows remain; only the new uniqueness constraint is removed.

BEGIN;

DROP TABLE IF EXISTS auth_challenges;
DROP INDEX IF EXISTS linked_identities_provider_subject_uidx;

COMMIT;

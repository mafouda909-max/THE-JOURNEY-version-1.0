-- THE JOURNEY — authenticated traveler ownership for contact requests
-- Additive/idempotent migration. Safe for existing anonymous requests because
-- traveler_account_id is nullable. Production application requires explicit
-- release authorization after verification on a temporary Neon branch.

BEGIN;

ALTER TABLE contact_requests
  ADD COLUMN IF NOT EXISTS traveler_account_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contact_requests_traveler_account_id_fkey'
      AND conrelid = 'contact_requests'::regclass
  ) THEN
    ALTER TABLE contact_requests
      ADD CONSTRAINT contact_requests_traveler_account_id_fkey
      FOREIGN KEY (traveler_account_id)
      REFERENCES accounts(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS contact_requests_traveler_account_idx
  ON contact_requests(traveler_account_id);

COMMIT;

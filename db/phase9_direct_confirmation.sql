-- SILA — direct service confirmation record (no platform booking or payment)
-- Additive migration. Apply to Preview/demo DB only after explicit review.
-- Requires db/phase5_quote_delivery_loop.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS agency_direct_confirmations (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES agency_workspaces(id) ON DELETE CASCADE,
  opportunity_id INTEGER NOT NULL REFERENCES agency_opportunities(id) ON DELETE CASCADE,
  quote_id INTEGER NOT NULL REFERENCES agency_quotes(id) ON DELETE CASCADE,
  quote_version_id INTEGER NOT NULL REFERENCES agency_quote_versions(id) ON DELETE RESTRICT,
  delivery_id INTEGER NOT NULL UNIQUE REFERENCES agency_quote_deliveries(id) ON DELETE CASCADE,
  provider_name VARCHAR(160) NOT NULL,
  confirmation_channel VARCHAR(20) NOT NULL,
  confirmation_note TEXT,
  reported_by_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  reported_at TIMESTAMP NOT NULL DEFAULT NOW(),
  traveler_response VARCHAR(20),
  traveler_response_note TEXT,
  traveler_responded_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT agency_direct_confirmations_channel_check
    CHECK (confirmation_channel IN ('phone','whatsapp','email','in_person','other')),
  CONSTRAINT agency_direct_confirmations_provider_name_check
    CHECK (length(btrim(provider_name)) BETWEEN 2 AND 160),
  CONSTRAINT agency_direct_confirmations_note_check
    CHECK (confirmation_note IS NULL OR length(confirmation_note) <= 500),
  CONSTRAINT agency_direct_confirmations_traveler_response_check
    CHECK (traveler_response IS NULL OR traveler_response IN ('confirmed','not_confirmed')),
  CONSTRAINT agency_direct_confirmations_traveler_note_check
    CHECK (traveler_response_note IS NULL OR length(traveler_response_note) <= 500),
  CONSTRAINT agency_direct_confirmations_traveler_response_state_check
    CHECK (
      (traveler_response IS NULL AND traveler_responded_at IS NULL AND traveler_response_note IS NULL)
      OR (traveler_response IS NOT NULL AND traveler_responded_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS agency_direct_confirmations_workspace_opportunity_idx
  ON agency_direct_confirmations(workspace_id, opportunity_id, reported_at DESC);

CREATE OR REPLACE FUNCTION enforce_agency_direct_confirmation_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  delivery_workspace_id INTEGER;
  delivery_opportunity_id INTEGER;
  delivery_quote_id INTEGER;
  delivery_quote_version_id INTEGER;
  delivery_status TEXT;
  delivery_response TEXT;
  delivery_expires_at TIMESTAMP;
BEGIN
  SELECT workspace_id, opportunity_id, quote_id, quote_version_id, status, response, expires_at
    INTO delivery_workspace_id, delivery_opportunity_id, delivery_quote_id,
         delivery_quote_version_id, delivery_status, delivery_response, delivery_expires_at
    FROM agency_quote_deliveries
   WHERE id = NEW.delivery_id
   LIMIT 1;

  IF NOT FOUND
     OR delivery_workspace_id <> NEW.workspace_id
     OR delivery_opportunity_id <> NEW.opportunity_id
     OR delivery_quote_id <> NEW.quote_id
     OR delivery_quote_version_id <> NEW.quote_version_id THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'direct confirmation must reference the exact delivered quote version';
  END IF;

  IF delivery_status <> 'responded' OR delivery_response <> 'approved' THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'direct confirmation requires an approved traveler response';
  END IF;

  IF TG_OP = 'INSERT' AND delivery_expires_at <= NOW() THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'direct confirmation must be reported before the quote delivery expires';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
       OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id
       OR NEW.quote_id IS DISTINCT FROM OLD.quote_id
       OR NEW.quote_version_id IS DISTINCT FROM OLD.quote_version_id
       OR NEW.delivery_id IS DISTINCT FROM OLD.delivery_id
       OR NEW.provider_name IS DISTINCT FROM OLD.provider_name
       OR NEW.confirmation_channel IS DISTINCT FROM OLD.confirmation_channel
       OR NEW.confirmation_note IS DISTINCT FROM OLD.confirmation_note
       OR NEW.reported_by_account_id IS DISTINCT FROM OLD.reported_by_account_id
       OR NEW.reported_at IS DISTINCT FROM OLD.reported_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'direct confirmation report is immutable';
    END IF;

    IF OLD.traveler_responded_at IS NOT NULL
       OR NEW.traveler_responded_at IS NULL
       OR NEW.traveler_response IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'traveler response can be recorded only once';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agency_direct_confirmation_integrity_guard ON agency_direct_confirmations;
CREATE TRIGGER agency_direct_confirmation_integrity_guard
BEFORE INSERT OR UPDATE ON agency_direct_confirmations
FOR EACH ROW
EXECUTE FUNCTION enforce_agency_direct_confirmation_integrity();

COMMIT;

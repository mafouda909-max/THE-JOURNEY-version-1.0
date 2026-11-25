-- SILA Phase 10: multi-provider open traveler requests.
-- Additive, idempotent. No Production execution is included in this PR.

BEGIN;

ALTER TABLE contact_requests
  ADD COLUMN IF NOT EXISTS request_kind VARCHAR(20) NOT NULL DEFAULT 'offer_inquiry',
  ADD COLUMN IF NOT EXISTS request_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS share_consent_at TIMESTAMP;

ALTER TABLE contact_requests
  ALTER COLUMN offer_id DROP NOT NULL,
  ALTER COLUMN agent_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'contact_requests_request_kind_check'
       AND conrelid = 'contact_requests'::regclass
  ) THEN
    ALTER TABLE contact_requests
      ADD CONSTRAINT contact_requests_request_kind_check
      CHECK (request_kind IN ('offer_inquiry','open_request'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'contact_requests_request_shape_check'
       AND conrelid = 'contact_requests'::regclass
  ) THEN
    ALTER TABLE contact_requests
      ADD CONSTRAINT contact_requests_request_shape_check
      CHECK (
        (request_kind = 'offer_inquiry'
          AND offer_id IS NOT NULL
          AND agent_id IS NOT NULL
          AND share_consent_at IS NULL)
        OR
        (request_kind = 'open_request'
          AND offer_id IS NULL
          AND agent_id IS NULL
          AND traveler_account_id IS NOT NULL
          AND share_consent_at IS NOT NULL
          AND jsonb_typeof(request_snapshot) = 'object')
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS contact_requests_kind_created_idx
  ON contact_requests(request_kind, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_request_recipients (
  id SERIAL PRIMARY KEY,
  contact_request_id INTEGER NOT NULL REFERENCES contact_requests(id) ON DELETE CASCADE,
  workspace_id INTEGER NOT NULL REFERENCES agency_workspaces(id) ON DELETE CASCADE,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  status VARCHAR(16) NOT NULL DEFAULT 'sent',
  matching_reason VARCHAR(120) NOT NULL,
  opportunity_id INTEGER REFERENCES agency_opportunities(id) ON DELETE SET NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
  viewed_at TIMESTAMP,
  responded_at TIMESTAMP,
  adopted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT marketplace_request_recipients_status_check
    CHECK (status IN ('sent','viewed','accepted','declined','withdrawn','expired')),
  CONSTRAINT marketplace_request_recipients_status_opportunity_check
    CHECK (
      (status = 'accepted' AND opportunity_id IS NOT NULL)
      OR (status <> 'accepted')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_request_recipients_request_workspace_uidx
  ON marketplace_request_recipients(contact_request_id, workspace_id);
CREATE INDEX IF NOT EXISTS marketplace_request_recipients_workspace_status_idx
  ON marketplace_request_recipients(workspace_id, status, sent_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_request_recipients_agent_idx
  ON marketplace_request_recipients(agent_id, sent_at DESC);

CREATE OR REPLACE FUNCTION enforce_marketplace_request_recipient_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  request_kind_value VARCHAR(20);
  workspace_agent_id INTEGER;
  recipient_count INTEGER;
  opportunity_workspace_id INTEGER;
  opportunity_request_id INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT request_kind
      INTO request_kind_value
      FROM contact_requests
     WHERE id = NEW.contact_request_id
     FOR UPDATE;

    IF NOT FOUND OR request_kind_value <> 'open_request' THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'recipient can only be added to an open traveler request';
    END IF;

    SELECT agent_id
      INTO workspace_agent_id
      FROM agency_workspaces
     WHERE id = NEW.workspace_id
       AND status = 'active'
     LIMIT 1;

    IF NOT FOUND OR workspace_agent_id <> NEW.agent_id THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'recipient workspace and agent must match an active agency workspace';
    END IF;

    SELECT COUNT(*)::int
      INTO recipient_count
      FROM marketplace_request_recipients
     WHERE contact_request_id = NEW.contact_request_id;

    IF recipient_count >= 5 THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'open traveler request recipient limit is five';
    END IF;

    IF NEW.status <> 'sent' OR NEW.opportunity_id IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'new marketplace recipients must begin in sent state';
    END IF;
  ELSE
    IF NEW.contact_request_id IS DISTINCT FROM OLD.contact_request_id
       OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
       OR NEW.agent_id IS DISTINCT FROM OLD.agent_id
       OR NEW.matching_reason IS DISTINCT FROM OLD.matching_reason
       OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'marketplace recipient routing identity is immutable';
    END IF;

    IF OLD.opportunity_id IS NOT NULL
       AND NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'marketplace recipient opportunity cannot be replaced';
    END IF;

    IF OLD.status IN ('accepted','declined','withdrawn','expired')
       AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'terminal marketplace recipient status cannot be changed';
    END IF;

    IF NEW.status = 'accepted' THEN
      IF NEW.opportunity_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
          MESSAGE = 'accepted marketplace recipient must reference its opportunity';
      END IF;

      SELECT workspace_id, source_contact_request_id
        INTO opportunity_workspace_id, opportunity_request_id
        FROM agency_opportunities
       WHERE id = NEW.opportunity_id
       LIMIT 1;

      IF NOT FOUND
         OR opportunity_workspace_id <> NEW.workspace_id
         OR opportunity_request_id <> NEW.contact_request_id THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
          MESSAGE = 'recipient opportunity must belong to the same workspace and request';
      END IF;
    ELSIF NEW.opportunity_id IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'only accepted marketplace recipients can reference an opportunity';
    END IF;

    IF NEW.status IN ('accepted','declined','withdrawn','expired')
       AND NEW.responded_at IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'terminal recipient decision requires a response timestamp';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_request_recipient_integrity_guard ON marketplace_request_recipients;
CREATE TRIGGER marketplace_request_recipient_integrity_guard
BEFORE INSERT OR UPDATE ON marketplace_request_recipients
FOR EACH ROW
EXECUTE FUNCTION enforce_marketplace_request_recipient_integrity();

COMMIT;

-- THE JOURNEY — Phase 5 Secure Client Quote Delivery Loop
-- Additive / idempotent migration. DO NOT execute against Production without Owner approval.
-- Requires phase1..phase4 in release-manifest order.
--
-- This layer turns internal quote snapshots into an explicit client-facing delivery boundary.
-- Bearer tokens are NEVER stored in plaintext: only a SHA-256 digest is persisted.
-- Client-visible delivery state is mutable operational state; commercial activities remain append-only truth.

BEGIN;

CREATE TABLE IF NOT EXISTS agency_quote_deliveries (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES agency_workspaces(id) ON DELETE CASCADE,
  opportunity_id INTEGER NOT NULL REFERENCES agency_opportunities(id) ON DELETE CASCADE,
  quote_id INTEGER NOT NULL REFERENCES agency_quotes(id) ON DELETE CASCADE,
  quote_version_id INTEGER NOT NULL REFERENCES agency_quote_versions(id) ON DELETE RESTRICT,
  token_digest CHAR(64) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  expires_at TIMESTAMP NOT NULL,
  first_viewed_at TIMESTAMP,
  last_viewed_at TIMESTAMP,
  response VARCHAR(24),
  response_message TEXT,
  responded_at TIMESTAMP,
  created_by_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT agency_quote_deliveries_channel_check
    CHECK (channel IN ('email','whatsapp','link','manual')),
  CONSTRAINT agency_quote_deliveries_status_check
    CHECK (status IN ('active','responded','revoked','expired')),
  CONSTRAINT agency_quote_deliveries_response_check
    CHECK (response IS NULL OR response IN ('approved','declined','changes_requested')),
  CONSTRAINT agency_quote_deliveries_token_digest_check
    CHECK (token_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT agency_quote_deliveries_view_order_check
    CHECK (first_viewed_at IS NULL OR last_viewed_at IS NULL OR first_viewed_at <= last_viewed_at),
  CONSTRAINT agency_quote_deliveries_response_state_check
    CHECK (
      (status = 'responded' AND response IS NOT NULL AND responded_at IS NOT NULL)
      OR (status <> 'responded' AND response IS NULL AND responded_at IS NULL AND response_message IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS agency_quote_deliveries_token_uidx
  ON agency_quote_deliveries(token_digest);
CREATE INDEX IF NOT EXISTS agency_quote_deliveries_opportunity_idx
  ON agency_quote_deliveries(opportunity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agency_quote_deliveries_quote_idx
  ON agency_quote_deliveries(quote_id, quote_version_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agency_quote_deliveries_active_expiry_idx
  ON agency_quote_deliveries(expires_at)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION enforce_agency_quote_delivery_record_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  quote_valid_until TIMESTAMP;
  quote_status TEXT;
  opportunity_stage TEXT;
BEGIN
  SELECT qv.valid_until, q.status, o.stage
    INTO quote_valid_until, quote_status, opportunity_stage
    FROM agency_quote_versions qv
    JOIN agency_quotes q
      ON q.id = qv.quote_id
     AND q.workspace_id = qv.workspace_id
     AND q.opportunity_id = qv.opportunity_id
    JOIN agency_opportunities o
      ON o.id = qv.opportunity_id
     AND o.workspace_id = qv.workspace_id
   WHERE qv.id = NEW.quote_version_id
     AND qv.quote_id = NEW.quote_id
     AND qv.workspace_id = NEW.workspace_id
     AND qv.opportunity_id = NEW.opportunity_id
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'quote delivery linkage does not match the canonical quote version';
  END IF;

  IF quote_status IN ('accepted','declined','expired','superseded') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'terminal quote cannot receive an active delivery';
  END IF;

  IF opportunity_stage IN ('won','lost','cancelled') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'terminal opportunity cannot receive an active delivery';
  END IF;

  IF quote_valid_until IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'client-facing quote delivery requires an explicit quote validity';
  END IF;

  IF quote_valid_until <= clock_timestamp() THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'expired quote version cannot receive a delivery';
  END IF;

  IF NEW.expires_at > quote_valid_until OR NEW.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'delivery expiry must be future-dated and no later than quote validity';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM agency_commercial_activities sent
     WHERE sent.workspace_id = NEW.workspace_id
       AND sent.opportunity_id = NEW.opportunity_id
       AND sent.quote_id = NEW.quote_id
       AND sent.quote_version_id = NEW.quote_version_id
       AND sent.activity_type = 'quote_sent'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'quote delivery requires a matching quote_sent commercial activity';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agency_quote_delivery_record_guard ON agency_quote_deliveries;
CREATE TRIGGER agency_quote_delivery_record_guard
BEFORE INSERT OR UPDATE OF workspace_id, opportunity_id, quote_id, quote_version_id, expires_at
ON agency_quote_deliveries
FOR EACH ROW
EXECUTE FUNCTION enforce_agency_quote_delivery_record_integrity();

CREATE OR REPLACE FUNCTION revoke_superseded_quote_deliveries()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.activity_type = 'quote_sent' AND NEW.quote_id IS NOT NULL AND NEW.quote_version_id IS NOT NULL THEN
    UPDATE agency_quote_deliveries
       SET status = 'revoked', updated_at = NOW()
     WHERE workspace_id = NEW.workspace_id
       AND opportunity_id = NEW.opportunity_id
       AND quote_id = NEW.quote_id
       AND quote_version_id <> NEW.quote_version_id
       AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agency_quote_delivery_supersession ON agency_commercial_activities;
CREATE TRIGGER agency_quote_delivery_supersession
AFTER INSERT
ON agency_commercial_activities
FOR EACH ROW
EXECUTE FUNCTION revoke_superseded_quote_deliveries();

CREATE OR REPLACE FUNCTION settle_quote_deliveries_on_terminal_quote()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('accepted','declined','expired','superseded') AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE agency_quote_deliveries
       SET status = 'revoked', updated_at = NOW()
     WHERE workspace_id = NEW.workspace_id
       AND quote_id = NEW.id
       AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agency_quote_delivery_quote_settlement ON agency_quotes;
CREATE TRIGGER agency_quote_delivery_quote_settlement
AFTER UPDATE OF status
ON agency_quotes
FOR EACH ROW
EXECUTE FUNCTION settle_quote_deliveries_on_terminal_quote();

CREATE OR REPLACE FUNCTION expire_quote_delivery_on_access(p_token_digest TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE agency_quote_deliveries
     SET status = 'expired', updated_at = NOW()
   WHERE token_digest = p_token_digest
     AND status = 'active'
     AND expires_at <= clock_timestamp();
END;
$$;

COMMIT;

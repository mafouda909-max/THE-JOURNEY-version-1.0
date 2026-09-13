-- THE JOURNEY — Phase 4 Quote Delivery & Outcome Integrity
-- Additive / idempotent migration. DO NOT execute against Production without Owner approval.
-- Requires phase1_agency_foundation.sql + phase2_agency_commercial_domain.sql
-- + phase3_supply_freshness_integrity.sql.
--
-- Principle:
--   1. An agent may only SEND the newest created version of a quote.
--   2. A WON outcome must bind a quote version that was actually sent.
--   3. If a newer version of that same quote was sent later, an older sent version
--      can no longer be accepted as the winning commercial truth.
--   4. Winning/losing an opportunity settles sibling quote aggregates consistently.
--
-- This deliberately distinguishes "latest created" from "latest communicated":
-- an agent may draft a newer version while the previously sent version is still the
-- client's valid decision surface. The newer draft only supersedes it once sent.

BEGIN;

DO $phase4_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agency_opportunities_won_quote_required_check'
  ) THEN
    ALTER TABLE agency_opportunities
      ADD CONSTRAINT agency_opportunities_won_quote_required_check
      CHECK (
        (stage = 'won' AND won_quote_version_id IS NOT NULL)
        OR (stage <> 'won' AND won_quote_version_id IS NULL)
      ) NOT VALID;
  END IF;
END
$phase4_constraints$;

CREATE OR REPLACE FUNCTION enforce_agency_quote_delivery_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  selected_version INTEGER;
  selected_valid_until TIMESTAMP;
  quote_status TEXT;
BEGIN
  IF NEW.activity_type <> 'quote_sent' THEN
    RETURN NEW;
  END IF;

  IF NEW.quote_id IS NULL OR NEW.quote_version_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'quote_sent requires quote_id and quote_version_id';
  END IF;

  SELECT qv.version, qv.valid_until, q.status
    INTO selected_version, selected_valid_until, quote_status
    FROM agency_quote_versions qv
    JOIN agency_quotes q
      ON q.id = qv.quote_id
     AND q.workspace_id = qv.workspace_id
     AND q.opportunity_id = qv.opportunity_id
   WHERE qv.id = NEW.quote_version_id
     AND qv.quote_id = NEW.quote_id
     AND qv.workspace_id = NEW.workspace_id
     AND qv.opportunity_id = NEW.opportunity_id
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'quote_sent linkage does not match the opportunity';
  END IF;

  IF quote_status IN ('accepted','declined','expired','superseded') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'terminal quote cannot be sent';
  END IF;

  IF selected_valid_until IS NOT NULL AND selected_valid_until <= clock_timestamp() THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'expired quote version cannot be sent';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM agency_quote_versions newer
     WHERE newer.workspace_id = NEW.workspace_id
       AND newer.opportunity_id = NEW.opportunity_id
       AND newer.quote_id = NEW.quote_id
       AND newer.version > selected_version
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'only the newest quote version may be sent';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agency_commercial_quote_delivery_guard ON agency_commercial_activities;
CREATE TRIGGER agency_commercial_quote_delivery_guard
BEFORE INSERT
ON agency_commercial_activities
FOR EACH ROW
EXECUTE FUNCTION enforce_agency_quote_delivery_integrity();

CREATE OR REPLACE FUNCTION enforce_agency_opportunity_outcome_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  winning_quote_id INTEGER;
  winning_version INTEGER;
  winning_valid_until TIMESTAMP;
  winning_quote_status TEXT;
BEGIN
  IF NEW.stage = 'won' THEN
    IF NEW.won_quote_version_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'won opportunity requires a winning quote version';
    END IF;

    SELECT qv.quote_id, qv.version, qv.valid_until, q.status
      INTO winning_quote_id, winning_version, winning_valid_until, winning_quote_status
      FROM agency_quote_versions qv
      JOIN agency_quotes q
        ON q.id = qv.quote_id
       AND q.workspace_id = qv.workspace_id
       AND q.opportunity_id = qv.opportunity_id
     WHERE qv.id = NEW.won_quote_version_id
       AND qv.workspace_id = NEW.workspace_id
       AND qv.opportunity_id = NEW.id
     LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'winning quote version does not belong to this opportunity';
    END IF;

    IF winning_quote_status IN ('declined','expired','superseded') THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'terminal rejected quote cannot win an opportunity';
    END IF;

    IF winning_valid_until IS NOT NULL AND winning_valid_until <= clock_timestamp() THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'expired quote version cannot win an opportunity';
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM agency_commercial_activities sent
       WHERE sent.workspace_id = NEW.workspace_id
         AND sent.opportunity_id = NEW.id
         AND sent.quote_id = winning_quote_id
         AND sent.quote_version_id = NEW.won_quote_version_id
         AND sent.activity_type = 'quote_sent'
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'winning quote version must have been sent to the client';
    END IF;

    IF EXISTS (
      SELECT 1
        FROM agency_commercial_activities sent
        JOIN agency_quote_versions later
          ON later.id = sent.quote_version_id
         AND later.workspace_id = sent.workspace_id
         AND later.opportunity_id = sent.opportunity_id
       WHERE sent.workspace_id = NEW.workspace_id
         AND sent.opportunity_id = NEW.id
         AND sent.quote_id = winning_quote_id
         AND sent.activity_type = 'quote_sent'
         AND later.quote_id = winning_quote_id
         AND later.version > winning_version
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'a newer sent version supersedes the selected winning quote version';
    END IF;
  ELSIF NEW.won_quote_version_id IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'only won opportunities may retain a winning quote version';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agency_opportunity_outcome_insert_guard ON agency_opportunities;
CREATE TRIGGER agency_opportunity_outcome_insert_guard
BEFORE INSERT
ON agency_opportunities
FOR EACH ROW
EXECUTE FUNCTION enforce_agency_opportunity_outcome_integrity();

DROP TRIGGER IF EXISTS agency_opportunity_outcome_update_guard ON agency_opportunities;
CREATE TRIGGER agency_opportunity_outcome_update_guard
BEFORE UPDATE OF stage, won_quote_version_id
ON agency_opportunities
FOR EACH ROW
EXECUTE FUNCTION enforce_agency_opportunity_outcome_integrity();

CREATE OR REPLACE FUNCTION settle_agency_quote_statuses_on_outcome()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  winning_quote_id INTEGER;
BEGIN
  IF NEW.stage = 'won' AND (OLD.stage IS DISTINCT FROM NEW.stage OR OLD.won_quote_version_id IS DISTINCT FROM NEW.won_quote_version_id) THEN
    SELECT quote_id INTO winning_quote_id
      FROM agency_quote_versions
     WHERE id = NEW.won_quote_version_id
       AND workspace_id = NEW.workspace_id
       AND opportunity_id = NEW.id
     LIMIT 1;

    UPDATE agency_quotes
       SET status = CASE WHEN id = winning_quote_id THEN 'accepted' ELSE 'superseded' END,
           updated_at = NOW()
     WHERE workspace_id = NEW.workspace_id
       AND opportunity_id = NEW.id
       AND status IN ('draft','sent','accepted');
  ELSIF NEW.stage = 'lost' AND OLD.stage IS DISTINCT FROM NEW.stage THEN
    UPDATE agency_quotes
       SET status = CASE WHEN status = 'sent' THEN 'declined' ELSE 'superseded' END,
           updated_at = NOW()
     WHERE workspace_id = NEW.workspace_id
       AND opportunity_id = NEW.id
       AND status IN ('draft','sent');
  ELSIF NEW.stage = 'cancelled' AND OLD.stage IS DISTINCT FROM NEW.stage THEN
    UPDATE agency_quotes
       SET status = 'superseded',
           updated_at = NOW()
     WHERE workspace_id = NEW.workspace_id
       AND opportunity_id = NEW.id
       AND status IN ('draft','sent');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agency_opportunity_quote_settlement ON agency_opportunities;
CREATE TRIGGER agency_opportunity_quote_settlement
AFTER UPDATE OF stage, won_quote_version_id
ON agency_opportunities
FOR EACH ROW
EXECUTE FUNCTION settle_agency_quote_statuses_on_outcome();

COMMIT;

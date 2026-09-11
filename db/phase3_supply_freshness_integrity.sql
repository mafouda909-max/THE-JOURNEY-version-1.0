-- THE JOURNEY — Phase 3 Supply Freshness Integrity
-- Additive / idempotent migration. DO NOT execute against Production without Owner approval.
-- Requires phase1_agency_foundation.sql + phase2_agency_commercial_domain.sql.
--
-- Principle: volatile travel inventory must carry real provenance, and a quote may
-- never promise commercial validity beyond the freshest underlying supplier evidence.

BEGIN;

-- Structural provenance constraints are NOT VALID so existing historical rows do not
-- block the rollout. PostgreSQL still enforces these constraints for new/updated rows.
DO $phase3_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agency_supplier_options_source_ref_check'
  ) THEN
    ALTER TABLE agency_supplier_options
      ADD CONSTRAINT agency_supplier_options_source_ref_check
      CHECK (
        category IN ('fee','other')
        OR (source_ref IS NOT NULL AND btrim(source_ref) <> '')
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agency_supplier_options_volatile_validity_check'
  ) THEN
    ALTER TABLE agency_supplier_options
      ADD CONSTRAINT agency_supplier_options_volatile_validity_check
      CHECK (
        category NOT IN ('flight','hotel','transfer','activity')
        OR valid_until IS NOT NULL
      ) NOT VALID;
  END IF;
END
$phase3_constraints$;

CREATE OR REPLACE FUNCTION enforce_agency_supplier_option_freshness()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.category IN ('flight','hotel','transfer','activity') THEN
    IF NEW.source_ref IS NULL OR btrim(NEW.source_ref) = '' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'volatile supplier options require a source reference';
    END IF;
    IF NEW.valid_until IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'volatile supplier options require a validity timestamp';
    END IF;
    IF NEW.valid_until <= clock_timestamp() THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'supplier option is already stale';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agency_supplier_options_freshness_guard ON agency_supplier_options;
CREATE TRIGGER agency_supplier_options_freshness_guard
BEFORE INSERT OR UPDATE OF category, source_ref, observed_at, valid_until, status
ON agency_supplier_options
FOR EACH ROW
EXECUTE FUNCTION enforce_agency_supplier_option_freshness();

CREATE OR REPLACE FUNCTION enforce_agency_quote_supply_freshness()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  line JSONB;
  line_kind TEXT;
  source_ref TEXT;
  observed_at TIMESTAMPTZ;
  line_valid_until TIMESTAMPTZ;
  earliest_valid_until TIMESTAMPTZ := NULL;
  has_volatile BOOLEAN := FALSE;
BEGIN
  IF jsonb_typeof(NEW.lines_snapshot) <> 'array' OR jsonb_array_length(NEW.lines_snapshot) = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'quote version requires line snapshots';
  END IF;

  FOR line IN SELECT value FROM jsonb_array_elements(NEW.lines_snapshot)
  LOOP
    line_kind := line->>'kind';
    source_ref := NULLIF(btrim(line#>>'{provenance,sourceRef}'), '');

    BEGIN
      observed_at := (line#>>'{provenance,observedAt}')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'quote line requires a valid observedAt timestamp';
    END;

    IF observed_at > clock_timestamp() + INTERVAL '5 minutes' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'quote line observedAt cannot be in the future';
    END IF;

    IF line_kind IN ('flight','hotel','transfer','activity') THEN
      has_volatile := TRUE;
      IF source_ref IS NULL THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'volatile quote line requires a source reference';
      END IF;

      BEGIN
        line_valid_until := (line#>>'{provenance,validUntil}')::timestamptz;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'volatile quote line requires a valid validity timestamp';
      END;

      IF line_valid_until IS NULL OR line_valid_until <= clock_timestamp() THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'volatile quote line is already stale';
      END IF;
      IF line_valid_until < observed_at THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'quote line validity cannot precede observation';
      END IF;
      IF earliest_valid_until IS NULL OR line_valid_until < earliest_valid_until THEN
        earliest_valid_until := line_valid_until;
      END IF;
    END IF;
  END LOOP;

  IF has_volatile THEN
    IF NEW.valid_until IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'supplier-backed quote requires valid_until';
    END IF;
    IF NEW.valid_until > earliest_valid_until THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'quote validity cannot outlive supplier evidence';
    END IF;
    IF NEW.valid_until <= clock_timestamp() THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'quote is already stale';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agency_quote_versions_freshness_guard ON agency_quote_versions;
CREATE TRIGGER agency_quote_versions_freshness_guard
BEFORE INSERT
ON agency_quote_versions
FOR EACH ROW
EXECUTE FUNCTION enforce_agency_quote_supply_freshness();

CREATE INDEX IF NOT EXISTS agency_supplier_options_valid_until_idx
  ON agency_supplier_options(workspace_id, valid_until)
  WHERE status IN ('active','selected') AND valid_until IS NOT NULL;

COMMIT;

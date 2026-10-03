-- THE JOURNEY — Phase 2 Canonical Agency Commercial Domain
-- Additive migration only. DO NOT execute against Production in this branch.
-- Requires db/phase1_agency_foundation.sql first.
--
-- Canonical flow:
-- Agency Client -> Opportunity -> immutable Traveler Intent Version
-- -> Supplier Options -> Quote -> immutable Quote Version
-- -> append-only Commercial Activity -> Outcome -> Intelligence Signal
-- -> privacy-safe Marketplace Projection.

BEGIN;

CREATE TABLE IF NOT EXISTS agency_clients (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES agency_workspaces(id) ON DELETE CASCADE,
  platform_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  preferred_language VARCHAR(16),
  created_by_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT agency_clients_contact_check CHECK (
    platform_account_id IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS agency_clients_workspace_idx
  ON agency_clients(workspace_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS agency_clients_workspace_email_uidx
  ON agency_clients(workspace_id, lower(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS agency_opportunities (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES agency_workspaces(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES agency_clients(id) ON DELETE RESTRICT,
  source VARCHAR(20) NOT NULL,
  source_contact_request_id INTEGER REFERENCES contact_requests(id) ON DELETE SET NULL,
  stage VARCHAR(20) NOT NULL DEFAULT 'new',
  assigned_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  title TEXT,
  outcome_reason TEXT,
  won_quote_version_id INTEGER,
  created_by_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMP,
  CONSTRAINT agency_opportunities_source_check CHECK (source IN ('marketplace','manual','referral','repeat','partner')),
  CONSTRAINT agency_opportunities_stage_check CHECK (stage IN ('new','qualified','sourcing','quoted','negotiating','won','lost','cancelled')),
  CONSTRAINT agency_opportunities_closed_check CHECK (
    (stage IN ('won','lost','cancelled') AND closed_at IS NOT NULL)
    OR (stage NOT IN ('won','lost','cancelled') AND closed_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS agency_opportunities_workspace_stage_idx
  ON agency_opportunities(workspace_id, stage, updated_at DESC);
CREATE INDEX IF NOT EXISTS agency_opportunities_client_idx
  ON agency_opportunities(client_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS agency_opportunities_source_contact_uidx
  ON agency_opportunities(workspace_id, source_contact_request_id)
  WHERE source_contact_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS agency_intent_versions (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES agency_workspaces(id) ON DELETE CASCADE,
  opportunity_id INTEGER NOT NULL REFERENCES agency_opportunities(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  intent_snapshot JSONB NOT NULL,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT agency_intent_versions_revision_check CHECK (revision > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS agency_intent_versions_opportunity_revision_uidx
  ON agency_intent_versions(opportunity_id, revision);
CREATE INDEX IF NOT EXISTS agency_intent_versions_workspace_created_idx
  ON agency_intent_versions(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agency_supplier_options (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES agency_workspaces(id) ON DELETE CASCADE,
  opportunity_id INTEGER NOT NULL REFERENCES agency_opportunities(id) ON DELETE CASCADE,
  category VARCHAR(24) NOT NULL,
  supplier_name TEXT NOT NULL,
  description TEXT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  cost_amount_minor BIGINT NOT NULL,
  commission_expected_minor BIGINT NOT NULL DEFAULT 0,
  source_type VARCHAR(24) NOT NULL,
  source_ref TEXT,
  observed_at TIMESTAMP NOT NULL,
  valid_until TIMESTAMP,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_by_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT agency_supplier_options_category_check CHECK (category IN ('flight','hotel','transfer','activity','insurance','visa','fee','other')),
  CONSTRAINT agency_supplier_options_source_check CHECK (source_type IN ('supplier_quote','booking_engine','contract','manual','platform')),
  CONSTRAINT agency_supplier_options_status_check CHECK (status IN ('active','expired','selected','rejected')),
  CONSTRAINT agency_supplier_options_cost_check CHECK (cost_amount_minor >= 0 AND commission_expected_minor >= 0),
  CONSTRAINT agency_supplier_options_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT agency_supplier_options_validity_check CHECK (valid_until IS NULL OR valid_until >= observed_at)
);

CREATE INDEX IF NOT EXISTS agency_supplier_options_opportunity_idx
  ON agency_supplier_options(opportunity_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS agency_quotes (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES agency_workspaces(id) ON DELETE CASCADE,
  opportunity_id INTEGER NOT NULL REFERENCES agency_opportunities(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  created_by_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT agency_quotes_status_check CHECK (status IN ('draft','sent','accepted','declined','expired','superseded'))
);

CREATE INDEX IF NOT EXISTS agency_quotes_opportunity_idx
  ON agency_quotes(opportunity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agency_quote_versions (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES agency_workspaces(id) ON DELETE CASCADE,
  opportunity_id INTEGER NOT NULL REFERENCES agency_opportunities(id) ON DELETE CASCADE,
  quote_id INTEGER NOT NULL REFERENCES agency_quotes(id) ON DELETE CASCADE,
  intent_version_id INTEGER NOT NULL REFERENCES agency_intent_versions(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL,
  cost_total_minor BIGINT NOT NULL,
  sell_total_minor BIGINT NOT NULL,
  commission_expected_minor BIGINT NOT NULL DEFAULT 0,
  gross_profit_minor BIGINT NOT NULL,
  margin_bps INTEGER NOT NULL,
  markup_bps INTEGER NOT NULL,
  lines_snapshot JSONB NOT NULL,
  client_facing_terms TEXT,
  valid_until TIMESTAMP,
  integrity_digest CHAR(64) NOT NULL,
  created_by_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT agency_quote_versions_version_check CHECK (version > 0),
  CONSTRAINT agency_quote_versions_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT agency_quote_versions_totals_check CHECK (
    cost_total_minor >= 0 AND sell_total_minor >= 0 AND commission_expected_minor >= 0
  ),
  CONSTRAINT agency_quote_versions_digest_check CHECK (integrity_digest ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS agency_quote_versions_quote_version_uidx
  ON agency_quote_versions(quote_id, version);
CREATE UNIQUE INDEX IF NOT EXISTS agency_quote_versions_digest_uidx
  ON agency_quote_versions(integrity_digest);
CREATE INDEX IF NOT EXISTS agency_quote_versions_opportunity_idx
  ON agency_quote_versions(opportunity_id, created_at DESC);

ALTER TABLE agency_opportunities
  DROP CONSTRAINT IF EXISTS agency_opportunities_won_quote_version_fk;
ALTER TABLE agency_opportunities
  ADD CONSTRAINT agency_opportunities_won_quote_version_fk
  FOREIGN KEY (won_quote_version_id) REFERENCES agency_quote_versions(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS agency_commercial_activities (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES agency_workspaces(id) ON DELETE CASCADE,
  opportunity_id INTEGER NOT NULL REFERENCES agency_opportunities(id) ON DELETE CASCADE,
  quote_id INTEGER REFERENCES agency_quotes(id) ON DELETE SET NULL,
  quote_version_id INTEGER REFERENCES agency_quote_versions(id) ON DELETE SET NULL,
  activity_type VARCHAR(24) NOT NULL,
  actor_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  channel VARCHAR(20),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT agency_commercial_activities_type_check CHECK (
    activity_type IN ('quote_sent','quote_viewed','follow_up','client_response','outcome_won','outcome_lost')
  )
);

CREATE INDEX IF NOT EXISTS agency_commercial_activities_opportunity_idx
  ON agency_commercial_activities(opportunity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS agency_commercial_activities_quote_idx
  ON agency_commercial_activities(quote_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS agency_intelligence_signals (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES agency_workspaces(id) ON DELETE CASCADE,
  opportunity_id INTEGER NOT NULL REFERENCES agency_opportunities(id) ON DELETE CASCADE,
  quote_version_id INTEGER REFERENCES agency_quote_versions(id) ON DELETE SET NULL,
  signal_kind VARCHAR(32) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  score REAL NOT NULL,
  explanation TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_name VARCHAR(64) NOT NULL DEFAULT 'deterministic-rules-v1',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT agency_intelligence_signals_severity_check CHECK (severity IN ('info','attention','high')),
  CONSTRAINT agency_intelligence_signals_score_check CHECK (score >= 0 AND score <= 1)
);

CREATE INDEX IF NOT EXISTS agency_intelligence_signals_opportunity_idx
  ON agency_intelligence_signals(opportunity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agency_marketplace_projections (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES agency_workspaces(id) ON DELETE CASCADE,
  opportunity_id INTEGER NOT NULL REFERENCES agency_opportunities(id) ON DELETE CASCADE,
  quote_version_id INTEGER NOT NULL REFERENCES agency_quote_versions(id) ON DELETE RESTRICT,
  offer_id INTEGER REFERENCES offers(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  projection_payload JSONB NOT NULL,
  created_by_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT agency_marketplace_projections_status_check CHECK (status IN ('draft','pending_review','published','withdrawn'))
);

CREATE UNIQUE INDEX IF NOT EXISTS agency_marketplace_projections_quote_version_uidx
  ON agency_marketplace_projections(quote_version_id);
CREATE UNIQUE INDEX IF NOT EXISTS agency_marketplace_projections_offer_uidx
  ON agency_marketplace_projections(offer_id) WHERE offer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION reject_agency_commercial_immutable_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is immutable; create a new version/event instead', TG_TABLE_NAME;
END;
$$;

DO $phase2$
DECLARE
  target_table TEXT;
  trigger_name TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'agency_intent_versions',
    'agency_quote_versions',
    'agency_commercial_activities'
  ]
  LOOP
    trigger_name := target_table || '_append_only';
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = trigger_name) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_agency_commercial_immutable_mutation()',
        trigger_name,
        target_table
      );
    END IF;
  END LOOP;
END
$phase2$;

COMMIT;

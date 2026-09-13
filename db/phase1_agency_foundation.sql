-- THE JOURNEY — Phase 1 Agency Foundation
-- Additive migration only. Do not run against Production as part of Phase 1.
-- Canonical parent: 03f0e02a142008f7c142957d0da65afa865babd1

BEGIN;

CREATE TABLE IF NOT EXISTS agency_workspaces (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT agency_workspaces_status_check CHECK (status IN ('active', 'suspended', 'closed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS agency_workspaces_agent_uidx
  ON agency_workspaces(agent_id);
CREATE INDEX IF NOT EXISTS agency_workspaces_status_idx
  ON agency_workspaces(status);

CREATE TABLE IF NOT EXISTS agency_memberships (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES agency_workspaces(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT agency_memberships_role_check CHECK (role IN ('owner', 'member')),
  CONSTRAINT agency_memberships_status_check CHECK (status IN ('active', 'disabled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS agency_memberships_workspace_account_uidx
  ON agency_memberships(workspace_id, account_id);
CREATE INDEX IF NOT EXISTS agency_memberships_account_idx
  ON agency_memberships(account_id);
CREATE INDEX IF NOT EXISTS agency_memberships_workspace_status_idx
  ON agency_memberships(workspace_id, status);

CREATE TABLE IF NOT EXISTS agency_domain_events (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES agency_workspaces(id) ON DELETE RESTRICT,
  actor_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  reference_type VARCHAR(32),
  reference_id INTEGER,
  correlation_id VARCHAR(80),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agency_domain_events_workspace_created_idx
  ON agency_domain_events(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS agency_domain_events_actor_idx
  ON agency_domain_events(actor_account_id);
CREATE INDEX IF NOT EXISTS agency_domain_events_type_idx
  ON agency_domain_events(event_type);

CREATE OR REPLACE FUNCTION reject_agency_domain_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'agency_domain_events is append-only';
END;
$$;

DO $phase1$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'agency_domain_events_append_only'
  ) THEN
    CREATE TRIGGER agency_domain_events_append_only
      BEFORE UPDATE OR DELETE ON agency_domain_events
      FOR EACH ROW EXECUTE FUNCTION reject_agency_domain_event_mutation();
  END IF;
END
$phase1$;

COMMIT;

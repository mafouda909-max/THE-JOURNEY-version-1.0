-- SILA: isolated Model B fulfillment pilot. Apply after phases 1-5.
-- Not in the automatic release chain. Keep the workspace allowlist empty until
-- migration checks and the commercial pilot's service/terms/budget are approved.
BEGIN;

CREATE TABLE IF NOT EXISTS sila_service_orders (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES agency_workspaces(id) ON DELETE RESTRICT,
  opportunity_id INTEGER NOT NULL REFERENCES agency_opportunities(id) ON DELETE RESTRICT,
  quote_version_id INTEGER NOT NULL REFERENCES agency_quote_versions(id) ON DELETE RESTRICT,
  supplier_option_id INTEGER NOT NULL REFERENCES agency_supplier_options(id) ON DELETE RESTRICT,
  partner_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  service_name TEXT NOT NULL CHECK (char_length(service_name) BETWEEN 1 AND 240),
  scope TEXT NOT NULL CHECK (char_length(scope) BETWEEN 1 AND 4000),
  acceptance_criteria TEXT NOT NULL CHECK (char_length(acceptance_criteria) BETWEEN 1 AND 2000),
  qualification_reference TEXT NOT NULL CHECK (char_length(qualification_reference) BETWEEN 1 AND 1000),
  due_at TIMESTAMPTZ NOT NULL,
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  supplier_cost_minor BIGINT NOT NULL CHECK (supplier_cost_minor BETWEEN 0 AND 9007199254740991),
  agency_sell_minor BIGINT NOT NULL CHECK (agency_sell_minor BETWEEN 0 AND 9007199254740991),
  sila_fee_minor BIGINT NOT NULL CHECK (sila_fee_minor BETWEEN 0 AND 9007199254740991),
  status VARCHAR(24) NOT NULL DEFAULT 'offered' CHECK (status IN ('offered','accepted','in_progress','delivered','rework','completed','declined','cancelled')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  last_note TEXT CHECK (last_note IS NULL OR char_length(last_note) <= 2000),
  completed_at TIMESTAMPTZ,
  created_by_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sila_service_completion_check CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS sila_service_order_active_line_uidx
  ON sila_service_orders(quote_version_id, supplier_option_id) WHERE status NOT IN ('declined','cancelled');
CREATE INDEX IF NOT EXISTS sila_service_order_workspace_idx ON sila_service_orders(workspace_id, opportunity_id, id);
CREATE INDEX IF NOT EXISTS sila_service_order_partner_idx ON sila_service_orders(partner_account_id, status, due_at);

CREATE TABLE IF NOT EXISTS sila_service_deliveries (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES sila_service_orders(id) ON DELETE RESTRICT,
  submitted_by_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  reference TEXT NOT NULL CHECK (char_length(reference) BETWEEN 1 AND 2000),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sila_service_deliveries_order_idx ON sila_service_deliveries(order_id, id);

CREATE TABLE IF NOT EXISTS sila_service_work_events (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES sila_service_orders(id) ON DELETE RESTRICT,
  actor_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  action VARCHAR(40) NOT NULL,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sila_service_work_events_order_idx ON sila_service_work_events(order_id, id);

CREATE TABLE IF NOT EXISTS sila_service_money_entries (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES sila_service_orders(id) ON DELETE RESTRICT,
  actor_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('receipt','refund','cost')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor BETWEEN 1 AND 9007199254740991),
  reference TEXT NOT NULL CHECK (char_length(reference) BETWEEN 1 AND 500),
  note TEXT NOT NULL CHECK (char_length(note) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sila_service_money_order_idx ON sila_service_money_entries(order_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS sila_service_money_reference_uidx ON sila_service_money_entries(order_id, kind, reference);

CREATE TABLE IF NOT EXISTS sila_service_command_receipts (
  actor_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  request_id VARCHAR(80) NOT NULL,
  command_digest VARCHAR(64) NOT NULL CHECK (command_digest ~ '^[a-f0-9]{64}$'),
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (actor_account_id, request_id)
);

-- Client follow-up has its own lifetime; quote price validity must not govern it.
-- Only token digests are stored. Reissuing revokes the previous client link.
CREATE TABLE IF NOT EXISTS sila_service_status_links (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES sila_service_orders(id) ON DELETE RESTRICT,
  token_digest VARCHAR(64) NOT NULL UNIQUE CHECK (token_digest ~ '^[a-f0-9]{64}$'),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_by_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sila_service_status_link_expiry_check CHECK (expires_at > created_at AND expires_at <= created_at + INTERVAL '30 days')
);
CREATE UNIQUE INDEX IF NOT EXISTS sila_service_status_link_active_uidx ON sila_service_status_links(order_id) WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION guard_sila_service_status_link()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.revoked_at IS NOT NULL OR NOT EXISTS (
      SELECT 1 FROM sila_service_orders o JOIN agency_memberships m ON m.workspace_id=o.workspace_id
      WHERE o.id=NEW.order_id AND m.account_id=NEW.created_by_account_id AND m.role='owner' AND m.status='active'
    ) THEN RAISE EXCEPTION 'Service link must be issued by its office owner'; END IF;
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Service link history is append-only';
  ELSE
    IF (to_jsonb(NEW) - 'revoked_at') IS DISTINCT FROM (to_jsonb(OLD) - 'revoked_at')
      OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN
      RAISE EXCEPTION 'Service link can only be revoked once';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sila_service_status_link_guard ON sila_service_status_links;
CREATE TRIGGER sila_service_status_link_guard BEFORE INSERT OR UPDATE OR DELETE ON sila_service_status_links FOR EACH ROW EXECUTE FUNCTION guard_sila_service_status_link();

CREATE OR REPLACE FUNCTION guard_sila_service_order()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM agency_opportunities o
      JOIN agency_quote_versions qv ON qv.id = NEW.quote_version_id AND qv.workspace_id = o.workspace_id AND qv.opportunity_id = o.id
      JOIN agency_quotes q ON q.id = qv.quote_id AND q.workspace_id = o.workspace_id AND q.opportunity_id = o.id
      JOIN agency_supplier_options s ON s.id = NEW.supplier_option_id AND s.workspace_id = o.workspace_id AND s.opportunity_id = o.id
      WHERE o.id = NEW.opportunity_id AND o.workspace_id = NEW.workspace_id
        AND o.stage = 'won' AND o.won_quote_version_id = qv.id AND q.status = 'accepted'
        AND (SELECT COUNT(*) FROM jsonb_array_elements(qv.lines_snapshot) line WHERE (line->>'supplierOptionId')::integer = s.id) = 1
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(qv.lines_snapshot) line
          WHERE (line->>'supplierOptionId')::integer = s.id
            AND NEW.service_name = line->>'label' AND NEW.currency = line->>'currency'
            AND NEW.supplier_cost_minor = (line->>'costUnitMinor')::numeric * (line->>'quantity')::numeric
            AND NEW.agency_sell_minor = (line->>'sellUnitMinor')::numeric * (line->>'quantity')::numeric)
    ) THEN RAISE EXCEPTION 'Service order must bind its own accepted commercial version and supplier'; END IF;
    IF NOT EXISTS (SELECT 1 FROM agency_memberships WHERE workspace_id=NEW.workspace_id AND account_id=NEW.created_by_account_id AND role='owner' AND status='active')
      OR EXISTS (SELECT 1 FROM agency_memberships WHERE workspace_id=NEW.workspace_id AND account_id=NEW.partner_account_id AND status='active') THEN
      RAISE EXCEPTION 'Service order needs its office owner and an external partner';
    END IF;
    IF NEW.status <> 'offered' OR NEW.revision <> 1 THEN RAISE EXCEPTION 'Service order must start offered'; END IF;
  ELSE
    IF (to_jsonb(NEW) - ARRAY['status','revision','last_note','completed_at','updated_at'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','revision','last_note','completed_at','updated_at']) THEN
      RAISE EXCEPTION 'Service order commercial terms are immutable';
    END IF;
    IF NEW.revision <> OLD.revision + 1 THEN RAISE EXCEPTION 'Service order revision must advance once'; END IF;
    IF NEW.status <> OLD.status AND NOT (
      (OLD.status = 'offered' AND NEW.status IN ('accepted','declined','cancelled')) OR
      (OLD.status = 'accepted' AND NEW.status IN ('in_progress','cancelled')) OR
      (OLD.status = 'in_progress' AND NEW.status IN ('delivered','cancelled')) OR
      (OLD.status = 'delivered' AND NEW.status IN ('completed','rework','cancelled')) OR
      (OLD.status = 'rework' AND NEW.status IN ('in_progress','cancelled'))
    ) THEN RAISE EXCEPTION 'Illegal service transition'; END IF;
    IF NEW.status IN ('delivered','completed') AND NOT EXISTS (SELECT 1 FROM sila_service_deliveries WHERE order_id = NEW.id) THEN
      RAISE EXCEPTION 'Delivery evidence is required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sila_service_order_guard ON sila_service_orders;
CREATE TRIGGER sila_service_order_guard BEFORE INSERT OR UPDATE ON sila_service_orders FOR EACH ROW EXECUTE FUNCTION guard_sila_service_order();

CREATE OR REPLACE FUNCTION guard_sila_service_delivery()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE assigned_account INTEGER; work_state TEXT;
BEGIN
  SELECT partner_account_id,status INTO assigned_account,work_state FROM sila_service_orders WHERE id=NEW.order_id FOR UPDATE;
  IF assigned_account IS DISTINCT FROM NEW.submitted_by_account_id OR work_state IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'Service delivery must come from its assigned working partner';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sila_service_delivery_guard ON sila_service_deliveries;
CREATE TRIGGER sila_service_delivery_guard BEFORE INSERT ON sila_service_deliveries FOR EACH ROW EXECUTE FUNCTION guard_sila_service_delivery();

CREATE OR REPLACE FUNCTION guard_sila_service_money()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE fee NUMERIC; receipts NUMERIC; refunds NUMERIC; costs NUMERIC;
BEGIN
  SELECT sila_fee_minor INTO fee FROM sila_service_orders WHERE id = NEW.order_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM sila_service_orders o JOIN agency_memberships m ON m.workspace_id=o.workspace_id
    WHERE o.id=NEW.order_id AND m.account_id=NEW.actor_account_id AND m.role='owner' AND m.status='active') THEN
    RAISE EXCEPTION 'Service money must be recorded by its office owner';
  END IF;
  SELECT COALESCE(SUM(amount_minor) FILTER (WHERE kind='receipt'),0),
         COALESCE(SUM(amount_minor) FILTER (WHERE kind='refund'),0),
         COALESCE(SUM(amount_minor) FILTER (WHERE kind='cost'),0)
    INTO receipts, refunds, costs FROM sila_service_money_entries WHERE order_id = NEW.order_id;
  IF (NEW.kind = 'receipt' AND receipts + NEW.amount_minor - refunds > fee)
    OR (NEW.kind = 'refund' AND refunds + NEW.amount_minor > receipts)
    OR (NEW.kind = 'receipt' AND receipts + NEW.amount_minor > 9007199254740991)
    OR (NEW.kind = 'cost' AND costs + NEW.amount_minor > 9007199254740991) THEN
    RAISE EXCEPTION 'Service fee ledger limits exceeded';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sila_service_money_guard ON sila_service_money_entries;
CREATE TRIGGER sila_service_money_guard BEFORE INSERT ON sila_service_money_entries FOR EACH ROW EXECUTE FUNCTION guard_sila_service_money();

CREATE OR REPLACE FUNCTION reject_sila_service_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Service history is append-only'; END;
$$;
DROP TRIGGER IF EXISTS sila_service_orders_no_delete ON sila_service_orders;
CREATE TRIGGER sila_service_orders_no_delete BEFORE DELETE ON sila_service_orders FOR EACH ROW EXECUTE FUNCTION reject_sila_service_history_mutation();
DROP TRIGGER IF EXISTS sila_service_work_events_append_only ON sila_service_work_events;
CREATE TRIGGER sila_service_work_events_append_only BEFORE UPDATE OR DELETE ON sila_service_work_events FOR EACH ROW EXECUTE FUNCTION reject_sila_service_history_mutation();
DROP TRIGGER IF EXISTS sila_service_deliveries_append_only ON sila_service_deliveries;
CREATE TRIGGER sila_service_deliveries_append_only BEFORE UPDATE OR DELETE ON sila_service_deliveries FOR EACH ROW EXECUTE FUNCTION reject_sila_service_history_mutation();
DROP TRIGGER IF EXISTS sila_service_money_append_only ON sila_service_money_entries;
CREATE TRIGGER sila_service_money_append_only BEFORE UPDATE OR DELETE ON sila_service_money_entries FOR EACH ROW EXECUTE FUNCTION reject_sila_service_history_mutation();
DROP TRIGGER IF EXISTS sila_service_receipts_append_only ON sila_service_command_receipts;
CREATE TRIGGER sila_service_receipts_append_only BEFORE UPDATE OR DELETE ON sila_service_command_receipts FOR EACH ROW EXECUTE FUNCTION reject_sila_service_history_mutation();
COMMIT;

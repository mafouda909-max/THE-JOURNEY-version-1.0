-- THE JOURNEY — canonical production PostgreSQL schema
-- Source of truth: src/db/schema.ts on main.
-- Intended for a fresh production database only.
-- Do NOT run against an existing database with a different schema without a reviewed migration plan.

BEGIN;

CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  display_name TEXT NOT NULL,
  latin_name TEXT NOT NULL,
  bio TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  license_type VARCHAR(16) NOT NULL,
  license_number VARCHAR(40),
  verification_status VARCHAR(16) NOT NULL DEFAULT 'in_review',
  verified_at TIMESTAMP,
  specialty_tags TEXT[] NOT NULL DEFAULT '{}',
  languages TEXT[] NOT NULL DEFAULT '{}',
  response_rate REAL NOT NULL DEFAULT 0,
  avg_response_hours REAL NOT NULL DEFAULT 24,
  total_trips INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offers (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_en TEXT,
  description TEXT NOT NULL,
  trip_type VARCHAR(16) NOT NULL,
  origin_city TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  destination_country TEXT NOT NULL,
  destination_country_en TEXT NOT NULL,
  departure_date TIMESTAMP,
  duration_days INTEGER,
  price_amount INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
  price_type VARCHAR(16) NOT NULL DEFAULT 'per_person',
  includes TEXT[] NOT NULL DEFAULT '{}',
  excludes TEXT[] NOT NULL DEFAULT '{}',
  min_travelers INTEGER NOT NULL DEFAULT 1,
  max_travelers INTEGER NOT NULL DEFAULT 8,
  status VARCHAR(20) NOT NULL DEFAULT 'pending_review',
  rejection_reason TEXT,
  hero_image TEXT NOT NULL,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  view_count INTEGER NOT NULL DEFAULT 0,
  contact_count INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_requests (
  id SERIAL PRIMARY KEY,
  offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  traveler_name TEXT NOT NULL,
  traveler_email TEXT NOT NULL,
  message TEXT NOT NULL,
  traveler_count INTEGER NOT NULL DEFAULT 2,
  travel_dates TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  offer_snapshot TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  content TEXT NOT NULL,
  is_verified_transaction BOOLEAN NOT NULL DEFAULT FALSE,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_documents (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  document_type VARCHAR(32) NOT NULL,
  storage_key TEXT NOT NULL,
  original_name TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  expires_at TIMESTAMP,
  verified_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  objective TEXT NOT NULL,
  audience TEXT NOT NULL,
  channels TEXT[] NOT NULL DEFAULT '{}',
  hypothesis TEXT NOT NULL,
  kpi TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_items (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  channel VARCHAR(24) NOT NULL,
  content_type VARCHAR(24) NOT NULL,
  body TEXT NOT NULL,
  cta TEXT,
  risk VARCHAR(8) NOT NULL DEFAULT 'low',
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  scheduled_for TIMESTAMP,
  published_at TIMESTAMP,
  performance_note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS experiments (
  id SERIAL PRIMARY KEY,
  hypothesis TEXT NOT NULL,
  metric TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'running',
  result TEXT,
  decision VARCHAR(12),
  owner TEXT NOT NULL DEFAULT 'Growth',
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  email VARCHAR(200) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(16) NOT NULL,
  display_name TEXT NOT NULL,
  agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  token VARCHAR(80) NOT NULL UNIQUE,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS linked_identities (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider VARCHAR(24) NOT NULL,
  provider_subject VARCHAR(120) NOT NULL,
  email VARCHAR(200),
  linked_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS travel_facts (
  id SERIAL PRIMARY KEY,
  subject VARCHAR(120) NOT NULL,
  attribute VARCHAR(80) NOT NULL,
  value TEXT NOT NULL,
  source TEXT NOT NULL,
  source_type VARCHAR(32) NOT NULL DEFAULT 'AGENT_REPORTED',
  authority_level INTEGER NOT NULL DEFAULT 1,
  retrieved_at TIMESTAMP NOT NULL DEFAULT NOW(),
  checked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMP,
  freshness_status VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
  confidence_score REAL NOT NULL DEFAULT 0.5,
  status VARCHAR(16) NOT NULL DEFAULT 'VERIFIED',
  external_reference TEXT
);

CREATE TABLE IF NOT EXISTS travel_knowledge (
  id SERIAL PRIMARY KEY,
  category VARCHAR(24) NOT NULL,
  country VARCHAR(64) NOT NULL,
  destination_country VARCHAR(64),
  data_payload TEXT NOT NULL,
  source_type VARCHAR(24) NOT NULL DEFAULT 'AGENT_REPORTED',
  freshness_status VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
  source_url TEXT,
  retrieved_at TIMESTAMP NOT NULL DEFAULT NOW(),
  checked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflows (
  id SERIAL PRIMARY KEY,
  workflow_id VARCHAR(80) NOT NULL,
  run_id VARCHAR(80) NOT NULL UNIQUE,
  trigger_event VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  errors TEXT,
  result TEXT,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link VARCHAR(200),
  idempotency_key VARCHAR(140) NOT NULL UNIQUE,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  actor VARCHAR(48) NOT NULL DEFAULT 'admin',
  action VARCHAR(48) NOT NULL,
  target_type VARCHAR(24) NOT NULL,
  target_id INTEGER NOT NULL,
  reason TEXT,
  prev_state VARCHAR(24),
  new_state VARCHAR(24),
  meta TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(48) NOT NULL,
  offer_id INTEGER,
  agent_id INTEGER,
  meta TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS offers_status_idx ON offers(status);
CREATE INDEX IF NOT EXISTS offers_agent_idx ON offers(agent_id);
CREATE INDEX IF NOT EXISTS contact_requests_offer_idx ON contact_requests(offer_id);
CREATE INDEX IF NOT EXISTS contact_requests_email_offer_idx ON contact_requests(traveler_email, offer_id);
CREATE INDEX IF NOT EXISTS agent_documents_agent_idx ON agent_documents(agent_id);
CREATE INDEX IF NOT EXISTS content_items_status_idx ON content_items(status);
CREATE INDEX IF NOT EXISTS accounts_agent_idx ON accounts(agent_id);
CREATE INDEX IF NOT EXISTS sessions_account_idx ON sessions(account_id);
CREATE INDEX IF NOT EXISTS linked_identities_account_idx ON linked_identities(account_id);
CREATE INDEX IF NOT EXISTS linked_identities_subject_idx ON linked_identities(provider, provider_subject);
CREATE INDEX IF NOT EXISTS travel_facts_subj_attr_idx ON travel_facts(subject, attribute);
CREATE INDEX IF NOT EXISTS travel_facts_freshness_idx ON travel_facts(freshness_status);
CREATE INDEX IF NOT EXISTS travel_knowledge_cat_country_idx ON travel_knowledge(category, country);
CREATE INDEX IF NOT EXISTS travel_knowledge_freshness_idx ON travel_knowledge(freshness_status);
CREATE INDEX IF NOT EXISTS workflows_id_idx ON workflows(workflow_id);
CREATE INDEX IF NOT EXISTS workflows_status_idx ON workflows(status);
CREATE INDEX IF NOT EXISTS notifications_account_idx ON notifications(account_id, created_at);
CREATE INDEX IF NOT EXISTS audit_target_idx ON audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS events_name_idx ON events(name);

COMMIT;

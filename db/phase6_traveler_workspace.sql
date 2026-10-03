-- SILA — Phase 6 Traveler Personal Workspace
-- Additive / idempotent migration. DO NOT execute against Production without Owner approval.
-- Requires release-manifest phases 1..5 first.
--
-- This layer gives travelers an owned Saved Intent and explicit linkages:
-- Intent -> compared marketplace offers -> inquiry.
-- Agency opportunity/quote linkage continues through contact_requests.source ownership.

BEGIN;

CREATE TABLE IF NOT EXISTS traveler_saved_intents (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  label VARCHAR(120) NOT NULL,
  intent_snapshot JSONB NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT traveler_saved_intents_status_check
    CHECK (status IN ('active','archived'))
);

CREATE INDEX IF NOT EXISTS traveler_saved_intents_account_updated_idx
  ON traveler_saved_intents(account_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS traveler_saved_intents_status_idx
  ON traveler_saved_intents(status);

CREATE TABLE IF NOT EXISTS traveler_intent_offers (
  saved_intent_id INTEGER NOT NULL REFERENCES traveler_saved_intents(id) ON DELETE CASCADE,
  offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT traveler_intent_offers_position_check CHECK (position >= 0),
  CONSTRAINT traveler_intent_offers_unique UNIQUE (saved_intent_id, offer_id)
);

CREATE INDEX IF NOT EXISTS traveler_intent_offers_intent_position_idx
  ON traveler_intent_offers(saved_intent_id, position, created_at);

CREATE TABLE IF NOT EXISTS traveler_intent_inquiries (
  saved_intent_id INTEGER NOT NULL REFERENCES traveler_saved_intents(id) ON DELETE CASCADE,
  contact_request_id INTEGER NOT NULL REFERENCES contact_requests(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT traveler_intent_inquiries_contact_unique UNIQUE (contact_request_id)
);

CREATE INDEX IF NOT EXISTS traveler_intent_inquiries_intent_idx
  ON traveler_intent_inquiries(saved_intent_id, created_at DESC);

COMMIT;

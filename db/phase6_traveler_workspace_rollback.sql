-- SILA — Phase 6 Traveler Personal Workspace rollback
-- DESTRUCTIVE: removes traveler saved intents and their offer/inquiry linkages.
-- DO NOT execute automatically and DO NOT include in the forward release manifest.
-- Use only after Owner approval and after confirming Phase 6 data is safe to discard/export.

BEGIN;

DROP TABLE IF EXISTS traveler_intent_inquiries;
DROP TABLE IF EXISTS traveler_intent_offers;
DROP TABLE IF EXISTS traveler_saved_intents;

COMMIT;

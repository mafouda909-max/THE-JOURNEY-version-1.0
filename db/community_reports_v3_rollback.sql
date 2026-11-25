-- SILA Community reports v3 rollback
-- DESTRUCTIVE: deletes all community reports. Backup and explicit owner approval required.
-- Never run automatically.

BEGIN;

DROP TABLE IF EXISTS community_reports;

COMMIT;

-- ============================================================================
-- THE JOURNEY — Migration 0200: Scheduled Jobs (AD-09, pg_cron inside Supabase)
-- Non-fatal when pg_cron is unavailable (plain local PG) — Supabase provisioning
-- enables these. Each job calls an idempotent function from 0110.
-- ============================================================================

BEGIN;

-- NOTE: the DO body uses the distinct tag $job$ because the cron command
-- strings below are themselves dollar-quoted with $$; a bare $$ outer tag
-- would be closed by the first inner $$ (dollar-quote collision).
DO $job$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron unavailable in this environment — job scheduling skipped (Supabase provisioning step).';
      RETURN;
    END;
  END IF;

  -- hourly: PUBLISHED → EXPIRED past valid_until + expiry notifications
  PERFORM cron.schedule('expire-offers', '7 * * * *',
    $$SELECT public.expire_published_offers();$$);

  -- daily: 7d/1d expiry reminders (agents + saved-offer holders)
  PERFORM cron.schedule('expiry-reminders', '15 3 * * *',
    $$SELECT public.send_expiry_reminders();$$);

  -- daily: auto-close RESPONDED contact requests after 30 silent days
  PERFORM cron.schedule('auto-close-contacts', '30 3 * * *',
    $$SELECT public.auto_close_responded_contacts();$$);

  -- daily: response-rate read-model recompute (rolling 90d, ≥5 samples)
  PERFORM cron.schedule('response-metrics', '45 3 * * *',
    $$SELECT public.recompute_response_metrics();$$);

  -- weekly: purge read notifications older than 90 days
  PERFORM cron.schedule('purge-notifications', '0 4 * * 6',
    $$DELETE FROM public.notifications WHERE read_at IS NOT NULL AND read_at < now() - INTERVAL '90 days';$$);
END $job$;

COMMIT;

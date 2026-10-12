-- ============================================================================
-- THE JOURNEY — STAGING-ONLY: Slice 2 E2E lifecycle fixture reset
--
-- ⚠ NEVER include this file in db/migrations/ and NEVER run it against
--   production. It exists solely to restore deterministic pre-run state on
--   the STAGING project (kmlsyyqmzgcmethgoglj) before a full Playwright run.
--
-- Every offer status change here follows the ratified closed-world whitelist
-- (B1 / assert_offer_transition) using multi-hop paths:
--     pending_review → published → expired        (T6 renewal fixture)
--     pending_review → rejected                   (T4 resubmission fixture)
--     pending_review → rejected → archived        (leftover cleanup)
--
-- Effects:
--   1. T6 fixture (…0201) back to EXPIRED with a past validity window.
--   2. T4 fixture (…0202) back to REJECTED with a visible rejection reason.
--   3. Wizard-created leftovers from earlier runs archived, freeing every
--      route slot so submit_own_offer's duplicate_live_offer guard cannot
--      collide across runs.
--   4. One in_review verification request for agent2 so the admin reject-note
--      queue test has a card to act on (cooldown trigger bypassed HERE ONLY —
--      the anchor rejection …0301 stays untouched, keeping the 30-day
--      cooldown test deterministic).
-- ============================================================================

BEGIN;

-- ── 1a. T6 fixture: pending → published (whitelist hop 2) ───────────────────
UPDATE public.offers
SET status = 'published'
WHERE id = '22222222-2222-4222-8222-000000000201'
  AND status = 'pending_review';

-- ── 1b. T6 fixture: published → expired (whitelist hop 5, past validity) ────
UPDATE public.offers
SET status      = 'expired',
    valid_until = now() - INTERVAL '7 days',
    submitted_at = NULL,
    rejection_reason = NULL
WHERE id = '22222222-2222-4222-8222-000000000201';

-- ── 2. T4 fixture: pending → rejected (whitelist hop 3, reason required by
--       the admin RPC — mirrored here so the UI shows the reason card) ──────
UPDATE public.offers
SET status           = 'rejected',
    valid_until      = now() + INTERVAL '20 days',
    submitted_at     = NULL,
    rejection_reason = 'السعر غير تنافسي — عدّل السعر وأعد الإرسال'
WHERE id = '22222222-2222-4222-8222-000000000202';

-- ── 3a. Leftovers: pending → rejected (whitelist hop 3; fixtures excluded) ──
UPDATE public.offers
SET status           = 'rejected',
    rejection_reason = COALESCE(rejection_reason, 'إعادة ضبط بيئة E2E')
WHERE agent_id IN (
        '22222222-2222-4222-8222-000000000011', -- e2e agent1
        '22222222-2222-4222-8222-000000000012'  -- e2e agent2
      )
  AND id::text NOT LIKE '22222222-%'
  AND status = 'pending_review';

-- ── 3b. Leftovers: everything live → archived (hops 8/9/10/11) ──────────────
UPDATE public.offers
SET status = 'archived'
WHERE agent_id IN (
        '22222222-2222-4222-8222-000000000011',
        '22222222-2222-4222-8222-000000000012'
      )
  AND id::text NOT LIKE '22222222-%'
  AND status <> 'archived';

-- ── 4. Admin verification queue card for the reject-note test ───────────────
DELETE FROM public.verification_requests
WHERE agent_id = '22222222-2222-4222-8222-000000000012'
  AND status = 'in_review';

ALTER TABLE public.verification_requests DISABLE TRIGGER trg_verification_cooldown;
INSERT INTO public.verification_requests (agent_id, status)
VALUES ('22222222-2222-4222-8222-000000000012', 'in_review');
ALTER TABLE public.verification_requests ENABLE TRIGGER trg_verification_cooldown;

COMMIT;

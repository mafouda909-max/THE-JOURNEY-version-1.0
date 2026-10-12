-- ============================================================================
-- THE JOURNEY — STAGING-ONLY: Slice 3 E2E contact fixtures
--
-- ⚠ NEVER include this file in db/migrations/ and NEVER run it against
--   production (kmlsyyqmzgcmethgoglj ONLY).
--
-- Provisions deterministic state for the Slice 3 Playwright journeys:
--   * e2e-traveler@e2e.local / Passw0rd!E2E — confirmed TRAVELER identity
--     (password hash cloned verbatim from the existing e2e-agent1 account,
--     which shares the same secret — no crypto required, fully deterministic)
--   * ONE published NON-DEMO offer owned by e2e agent1, live for 45 days,
--     reachable through the canonical public_offers projection
--   * cleanup of any prior contact_requests from earlier runs
--
-- Idempotent: safe to re-run before every full suite.
-- ============================================================================

BEGIN;

-- ── 0. Deterministic ids ─────────────────────────────────────────────────────
-- traveler uid : 22222222-2222-4222-8222-000000000101
-- fixture offer: 22222222-2222-4222-8222-000000000220

-- ── 1. Clean previous run artifacts (dependency order) ──────────────────────
DELETE FROM public.contact_requests
WHERE traveler_id = '22222222-2222-4222-8222-000000000101'
   OR offer_id    = '22222222-2222-4222-8222-000000000220';

DELETE FROM public.notifications
WHERE payload ->> 'contact_request_id' IS NOT NULL
  AND recipient_id IN (
        '22222222-2222-4222-8222-000000000101',      -- e2e traveler
        (SELECT user_id FROM public.agent_profiles
          WHERE id = '22222222-2222-4222-8222-000000000011') -- e2e agent1
      );

DELETE FROM public.offers WHERE id = '22222222-2222-4222-8222-000000000220';

DELETE FROM public.users WHERE id = '22222222-2222-4222-8222-000000000101';
DELETE FROM auth.identities WHERE user_id = '22222222-2222-4222-8222-000000000101';
DELETE FROM auth.users WHERE id = '22222222-2222-4222-8222-000000000101';

-- ── 2. E2E traveler identity (confirmed; role defaults to traveler) ─────────
-- GoTrue scans every varchar column into a non-nullable string: ANY NULL
-- token/change column crashes password grant ("Scan error … converting NULL
-- to string"). Several have NO column default, so set them ALL to '' —
-- exactly what a real signup produces.
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-4222-8222-000000000101',
  'authenticated', 'authenticated', 'e2e-traveler@e2e.local',
  (SELECT encrypted_password FROM auth.users WHERE email = 'e2e-agent1@e2e.local'),
  now(),
  '', '', '',
  '', '',
  '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"role":"traveler","language":"ar","display_name":"E2E مسافر"}'::jsonb,
  now(), now(), false, false
);
-- confirmed_at is a GENERATED column (derived from email_confirmed_at).
-- trg_handle_new_user mirrors the row into public.users as role=traveler.

-- Email identity row — GoTrue REFUSES to sign in without it
-- ("Database error querying schema"). provider_id = user id per GoTrue
-- convention; `email` is GENERATED from identity_data — never insert it.
INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '22222222-2222-4222-8222-000000000101',
  '22222222-2222-4222-8222-000000000101',
  'email',
  jsonb_build_object(
    'sub', '22222222-2222-4222-8222-000000000101',
    'email', 'e2e-traveler@e2e.local',
    'email_verified', true
  ),
  now(), now(), now()
);

-- ── 3. Published non-demo offer owned by the verified e2e agent1 ────────────
INSERT INTO public.offers (
  id, agent_id,
  title_ar, description_ar,
  trip_type, route_type,
  origin_city_id, destination_city_id,
  price_amount, currency, price_type, price_basis,
  includes, min_travelers,
  status, valid_from, valid_until, published_at,
  is_demo
)
SELECT
  '22222222-2222-4222-8222-000000000220',
  ap.id,
  'عرض E2E للتواصل — القاهرة إلى إسطنبول',
  'عرض حقيقي غير تجريبي مخصص لاختبار رحلة التواصل في بيئة التدريب فقط.',
  'flight', 'direct',
  oc.id, dc.id,
  12500.00, 'EGP', 'fixed', 'per_person',
  ARRAY['طيران ذهاب وعودة']::text[], 1,
  'published', now() - INTERVAL '1 day', now() + INTERVAL '45 days', now() - INTERVAL '1 day',
  false
FROM public.agent_profiles ap
JOIN public.cities oc ON oc.name_ar = 'القاهرة'
JOIN public.cities dc ON dc.name_ar = 'إسطنبول'
WHERE ap.user_id = '22222222-2222-4222-8222-000000000001'  -- e2e agent1 uid
LIMIT 1;

COMMIT;

-- ============================================================================
-- THE JOURNEY — Migration 0220: Agent Operations (Slice 2 database work)
--
-- Ratified additions ONLY:
--   T4/T6 : resubmit_own_offer        (rejected|expired → pending_review)
--   E1    : update_own_offer_minor    (published; descriptions/includes/excludes)
--   E2    : submit_offer_major_edit   (published; price/route/dates/validity;
--           atomic PUBLISHED→PENDING_REVIEW + Q2 snapshot into admin_actions)
--   §3.9  : update_own_offer_draft    (pre-publication content edits while
--           draft/rejected/expired — "Owner: full CRUD within state rules";
--           never touches status)
--   D3-cooldown : 30-day rejected-verification resubmission enforcement
--           (BEFORE INSERT trigger function on verification_requests)
--   Storage: offer-media / verification-documents buckets + policies
--
-- Preserved invariants:
--   * closed-world transition whitelist untouched (pairs #4/#6/#7 pre-exist)
--   * NO authenticated UPDATE grant on offers (all edits via definer fns)
--   * no analytics/view-count · no new offer states
-- ============================================================================

BEGIN;
-- ════════════════════════════════════════════════════════════════════════════
-- 1. STORAGE BUCKETS (Decision 2) — idempotent upserts
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('offer-media', 'offer-media', true, 10485760,
   ARRAY['image/jpeg','image/png','image/webp']),
  ('verification-documents', 'verification-documents', false, 10485760,
   ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT (id) DO UPDATE
  SET public           = EXCLUDED.public,
      file_size_limit  = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. STORAGE POLICIES (path conventions ratified)
--    offer-media/{offer_id}/{sort}-{filename}
--    verification-documents/{agent_id}/{request_id}/{doc_type}-{filename}
-- ════════════════════════════════════════════════════════════════════════════

-- ── offer-media: world-readable ─────────────────────────────────────────────
DROP POLICY IF EXISTS om_public_read ON storage.objects;
CREATE POLICY om_public_read ON storage.objects FOR SELECT
  USING (bucket_id = 'offer-media');

DROP POLICY IF EXISTS om_agent_insert ON storage.objects;
CREATE POLICY om_agent_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'offer-media'
    AND EXISTS (
      SELECT 1
      FROM public.offers o
      JOIN public.agent_profiles ap ON ap.id = o.agent_id
      WHERE o.id::text = (storage.foldername(name))[1]
        AND ap.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS om_agent_update ON storage.objects;
CREATE POLICY om_agent_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'offer-media'
    AND EXISTS (
      SELECT 1 FROM public.offers o
      JOIN public.agent_profiles ap ON ap.id = o.agent_id
      WHERE o.id::text = (storage.foldername(name))[1]
        AND ap.user_id = auth.uid()
    )
  )
  WITH CHECK (bucket_id = 'offer-media');

DROP POLICY IF EXISTS om_agent_delete ON storage.objects;
CREATE POLICY om_agent_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'offer-media'
    AND EXISTS (
      SELECT 1 FROM public.offers o
      JOIN public.agent_profiles ap ON ap.id = o.agent_id
      WHERE o.id::text = (storage.foldername(name))[1]
        AND ap.user_id = auth.uid()
    )
  );

-- ── verification-documents: private; owning agent only (admins obtain access
--    exclusively through service-side signed URLs — AD-06 strictest rule) ────
DROP POLICY IF EXISTS vd_agent_read ON storage.objects;
CREATE POLICY vd_agent_read ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND EXISTS (
      SELECT 1 FROM public.agent_profiles ap
      WHERE ap.id::text = (storage.foldername(name))[1]
        AND ap.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS vd_agent_insert_inreview ON storage.objects;
CREATE POLICY vd_agent_insert_inreview ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = (
      SELECT ap.id::text FROM public.agent_profiles ap WHERE ap.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.verification_requests r
      WHERE r.id::text = (storage.foldername(name))[2]
        AND r.agent_id::text = (storage.foldername(name))[1]
        AND r.status = 'in_review'
    )
  );
-- No UPDATE/DELETE policies: uploaded documents are immutable (AD-06).

-- ════════════════════════════════════════════════════════════════════════════
-- 3. VERIFICATION RESUBMISSION COOLDOWN (Decision 3 — server-side, 30 days)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.enforce_verification_cooldown()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $_cooldown_$
DECLARE
  v_last_rejection timestamptz;
BEGIN
  IF NEW.status <> 'in_review' OR NEW.agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT max(reviewed_at) INTO v_last_rejection
  FROM public.verification_requests
  WHERE agent_id = NEW.agent_id AND status = 'rejected';

  IF v_last_rejection IS NOT NULL
     AND v_last_rejection > now() - INTERVAL '30 days' THEN
    RAISE EXCEPTION
      'verification_cooldown_active: resubmission available after %',
      v_last_rejection + INTERVAL '30 days'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$_cooldown_$;

DROP TRIGGER IF EXISTS trg_verification_cooldown ON public.verification_requests;
CREATE TRIGGER trg_verification_cooldown
  BEFORE INSERT ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_verification_cooldown();

-- ════════════════════════════════════════════════════════════════════════════
-- 4. T4/T6 — REJECTED | EXPIRED → PENDING_REVIEW
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.resubmit_own_offer(
  p_offer_id uuid,
  p_new_valid_until timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $_resub_$
DECLARE
  v         public.offers%ROWTYPE;
  v_agent   uuid := public.current_agent_profile_id();
  v_target  timestamptz;
BEGIN
  IF v_agent IS NULL THEN RAISE EXCEPTION 'not an agent account'; END IF;

  SELECT * INTO v FROM public.offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND OR v.agent_id <> v_agent THEN
    RAISE EXCEPTION 'offer not found for this agent';
  END IF;
  IF v.status NOT IN ('rejected','expired') THEN
    RAISE EXCEPTION 'invalid state: % (expected rejected|expired)', v.status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.agent_profiles
    WHERE id = v_agent AND verification_status = 'verified'
  ) THEN RAISE EXCEPTION 'agent_not_verified';
  END IF;

  v_target := COALESCE(p_new_valid_until, v.valid_until);
  IF v_target <= now() THEN
    RAISE EXCEPTION 'valid_until must be in the future';
  END IF;
  -- Ratified T6 default: a renewal must carry a strictly newer validity.
  IF v.status = 'expired' AND p_new_valid_until IS NOT NULL
     AND p_new_valid_until <= v.valid_until THEN
    RAISE EXCEPTION 'renewal valid_until must extend the current validity window';
  END IF;

  -- Duplicate live-offer guard (same agent/route/trip_type overlap), self-excluded
  IF EXISTS (
    SELECT 1 FROM public.offers o
    WHERE o.agent_id = v_agent
      AND o.id <> v.id
      AND o.origin_city_id = v.origin_city_id
      AND o.destination_city_id = v.destination_city_id
      AND o.trip_type = v.trip_type
      AND o.status IN ('pending_review','published')
      AND o.valid_from < v_target
      AND o.valid_until > v.valid_from
  ) THEN RAISE EXCEPTION 'duplicate_live_offer: overlapping live offer exists for this route';
  END IF;

  UPDATE public.offers
  SET status = 'pending_review',
      submitted_at = now(),
      rejection_reason = NULL,
      valid_until = v_target
  WHERE id = v.id;
END;
$_resub_$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Pre-publication content editing (§3.9 "Owner: full CRUD within state
--    rules") — while draft/rejected/expired, WITHOUT touching status.
--    Lifecycle changes still go through resubmit_own_offer.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_own_offer_prepublication(
  p_offer_id           uuid,
  p_title_ar           varchar(200) DEFAULT NULL,
  p_title_en           varchar(200) DEFAULT NULL,
  p_description_ar     text         DEFAULT NULL,
  p_description_en     text         DEFAULT NULL,
  p_trip_type          public.enum_trip_type   DEFAULT NULL,
  p_route_type         public.enum_route_type  DEFAULT NULL,
  p_origin_city_id     uuid        DEFAULT NULL,
  p_destination_city_id uuid       DEFAULT NULL,
  p_origin_airport_id  uuid        DEFAULT NULL,
  p_destination_airport_id uuid    DEFAULT NULL,
  p_airline_id         uuid        DEFAULT NULL,
  p_departure_date     date        DEFAULT NULL,
  p_return_date        date        DEFAULT NULL,
  p_duration_days      integer     DEFAULT NULL,
  p_flexible_dates     boolean     DEFAULT NULL,
  p_price_amount       numeric(12,2) DEFAULT NULL,
  p_currency           char(3)     DEFAULT NULL,
  p_price_type         public.enum_price_type  DEFAULT NULL,
  p_price_basis        public.enum_price_basis DEFAULT NULL,
  p_includes           text[]      DEFAULT NULL,
  p_excludes           text[]      DEFAULT NULL,
  p_min_travelers      integer     DEFAULT NULL,
  p_max_travelers      integer     DEFAULT NULL,
  p_valid_from         timestamptz DEFAULT NULL,
  p_valid_until        timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $_prep_$
DECLARE
  v       public.offers%ROWTYPE;
  v_agent uuid := public.current_agent_profile_id();
BEGIN
  IF v_agent IS NULL THEN RAISE EXCEPTION 'not an agent account'; END IF;

  SELECT * INTO v FROM public.offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND OR v.agent_id <> v_agent THEN
    RAISE EXCEPTION 'offer not found for this agent';
  END IF;
  IF v.status NOT IN ('draft','rejected','expired') THEN
    RAISE EXCEPTION 'invalid state: % (use minor/major edit RPCs for published offers)', v.status;
  END IF;
  -- Contract: NULL params mean "leave unchanged" for non-clearable columns.
  -- The five CLEARABLE refinement columns (origin_airport_id,
  -- destination_airport_id, airline_id, return_date, max_travelers) are set
  -- from their parameter directly — callers (the edit UI) must therefore
  -- always send the complete desired state for those five columns.
  UPDATE public.offers SET
    title_ar               = COALESCE(p_title_ar, title_ar),
    title_en               = COALESCE(p_title_en, title_en),
    description_ar         = COALESCE(p_description_ar, description_ar),
    description_en         = COALESCE(p_description_en, description_en),
    trip_type              = COALESCE(p_trip_type, trip_type),
    route_type             = COALESCE(p_route_type, route_type),
    origin_city_id         = COALESCE(p_origin_city_id, origin_city_id),
    destination_city_id    = COALESCE(p_destination_city_id, destination_city_id),
    origin_airport_id      = p_origin_airport_id,
    destination_airport_id = p_destination_airport_id,
    airline_id             = p_airline_id,
    departure_date         = p_departure_date,
    return_date            = p_return_date,
    duration_days          = COALESCE(p_duration_days, duration_days),
    flexible_dates         = COALESCE(p_flexible_dates, flexible_dates),
    price_amount           = COALESCE(p_price_amount, price_amount),
    currency               = COALESCE(p_currency, currency),
    price_type             = COALESCE(p_price_type, price_type),
    price_basis            = COALESCE(p_price_basis, price_basis),
    includes               = COALESCE(p_includes, includes),
    excludes               = COALESCE(p_excludes, excludes),
    min_travelers          = COALESCE(p_min_travelers, min_travelers),
    max_travelers          = p_max_travelers,
    valid_from             = COALESCE(p_valid_from, valid_from),
    valid_until            = COALESCE(p_valid_until, valid_until)
  WHERE id = v.id;
END;
$_prep_$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. E1 — minor edit on PUBLISHED offers (descriptions + inclusions ONLY)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_own_offer_minor(
  p_offer_id       uuid,
  p_description_ar text DEFAULT NULL,
  p_description_en text DEFAULT NULL,
  p_includes       text[] DEFAULT NULL,
  p_excludes       text[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $_minor_$
DECLARE
  v       public.offers%ROWTYPE;
  v_agent uuid := public.current_agent_profile_id();
  v_touched boolean := false;
BEGIN
  IF v_agent IS NULL THEN RAISE EXCEPTION 'not an agent account'; END IF;

  SELECT * INTO v FROM public.offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND OR v.agent_id <> v_agent THEN
    RAISE EXCEPTION 'offer not found for this agent';
  END IF;
  IF v.status <> 'published' THEN
    RAISE EXCEPTION 'invalid state: % (minor edit applies to published offers)', v.status;
  END IF;

  IF p_description_ar IS NOT NULL THEN
    IF char_length(btrim(p_description_ar)) = 0 THEN
      RAISE EXCEPTION 'description_ar cannot be empty';
    END IF;
    UPDATE public.offers SET description_ar = btrim(p_description_ar) WHERE id = v.id;
    v_touched := true;
  END IF;
  IF p_description_en IS NOT NULL THEN
    UPDATE public.offers SET description_en = nullif(btrim(p_description_en),'') WHERE id = v.id;
    v_touched := true;
  END IF;
  IF p_includes IS NOT NULL THEN
    UPDATE public.offers SET includes = p_includes WHERE id = v.id;
    v_touched := true;
  END IF;
  IF p_excludes IS NOT NULL THEN
    UPDATE public.offers SET excludes = p_excludes WHERE id = v.id;
    v_touched := true;
  END IF;

  IF NOT v_touched THEN RAISE EXCEPTION 'nothing to update'; END IF;
END;
$_minor_$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. E2 — major edit on PUBLISHED offers: PRICE/ROUTE/DATES/VALIDITY fields
--    applied ATOMICALLY with PUBLISHED → PENDING_REVIEW, plus the Q2-pinned
--    moderation snapshot {before, after, changed_fields[]} in admin_actions.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.submit_offer_major_edit(
  p_offer_id            uuid,
  p_price_amount        numeric(12,2) DEFAULT NULL,
  p_currency            char(3)     DEFAULT NULL,
  p_price_type          public.enum_price_type  DEFAULT NULL,
  p_price_basis         public.enum_price_basis DEFAULT NULL,
  p_origin_city_id      uuid        DEFAULT NULL,
  p_destination_city_id uuid        DEFAULT NULL,
  p_origin_airport_id   uuid        DEFAULT NULL,
  p_destination_airport_id uuid      DEFAULT NULL,
  p_airline_id          uuid        DEFAULT NULL,
  p_route_type          public.enum_route_type DEFAULT NULL,
  p_departure_date      date        DEFAULT NULL,
  p_return_date         date        DEFAULT NULL,
  p_duration_days       integer     DEFAULT NULL,
  p_flexible_dates      boolean     DEFAULT NULL,
  p_valid_from          timestamptz DEFAULT NULL,
  p_valid_until         timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $_major_$
DECLARE
  v_old     public.offers%ROWTYPE;
  v_new     public.offers%ROWTYPE;
  v_agent   uuid := public.current_agent_profile_id();
  t_changed text[] := '{}';
BEGIN
  IF v_agent IS NULL THEN RAISE EXCEPTION 'not an agent account'; END IF;

  SELECT * INTO v_old FROM public.offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND OR v_old.agent_id <> v_agent THEN
    RAISE EXCEPTION 'offer not found for this agent';
  END IF;
  IF v_old.status <> 'published' THEN
    RAISE EXCEPTION 'invalid state: % (major edit applies to published offers)', v_old.status;
  END IF;

  UPDATE public.offers SET
    price_amount           = COALESCE(p_price_amount, price_amount),
    currency               = COALESCE(p_currency, currency),
    price_type             = COALESCE(p_price_type, price_type),
    price_basis            = COALESCE(p_price_basis, price_basis),
    origin_city_id         = COALESCE(p_origin_city_id, origin_city_id),
    destination_city_id    = COALESCE(p_destination_city_id, destination_city_id),
    origin_airport_id      = p_origin_airport_id,
    destination_airport_id = p_destination_airport_id,
    airline_id             = p_airline_id,
    route_type             = COALESCE(p_route_type, route_type),
    departure_date         = p_departure_date,
    return_date            = p_return_date,
    duration_days          = COALESCE(p_duration_days, duration_days),
    flexible_dates         = COALESCE(p_flexible_dates, flexible_dates),
    valid_from             = COALESCE(p_valid_from, valid_from),
    valid_until            = COALESCE(p_valid_until, valid_until),
    -- Atomic edit + transition (whitelist pair #7):
    status                 = 'pending_review',
    submitted_at           = now(),
    rejection_reason       = NULL
  WHERE id = v_old.id
  RETURNING * INTO v_new;

  IF p_price_amount        IS NOT NULL AND p_price_amount        IS DISTINCT FROM v_old.price_amount THEN
    t_changed := array_append(t_changed, 'price_amount'); END IF;
  IF p_currency            IS NOT NULL AND p_currency            IS DISTINCT FROM v_old.currency THEN
    t_changed := array_append(t_changed, 'currency'); END IF;
  IF p_price_type          IS NOT NULL AND p_price_type          IS DISTINCT FROM v_old.price_type THEN
    t_changed := array_append(t_changed, 'price_type'); END IF;
  IF p_price_basis         IS NOT NULL AND p_price_basis         IS DISTINCT FROM v_old.price_basis THEN
    t_changed := array_append(t_changed, 'price_basis'); END IF;
  IF p_origin_city_id      IS NOT NULL AND p_origin_city_id      IS DISTINCT FROM v_old.origin_city_id THEN
    t_changed := array_append(t_changed, 'origin_city_id'); END IF;
  IF p_destination_city_id IS NOT NULL AND p_destination_city_id IS DISTINCT FROM v_old.destination_city_id THEN
    t_changed := array_append(t_changed, 'destination_city_id'); END IF;
  IF p_origin_airport_id   IS DISTINCT FROM v_old.origin_airport_id THEN
    t_changed := array_append(t_changed, 'origin_airport_id'); END IF;
  IF p_destination_airport_id IS DISTINCT FROM v_old.destination_airport_id THEN
    t_changed := array_append(t_changed, 'destination_airport_id'); END IF;
  IF p_airline_id          IS DISTINCT FROM v_old.airline_id THEN
    t_changed := array_append(t_changed, 'airline_id'); END IF;
  IF p_route_type          IS NOT NULL AND p_route_type          IS DISTINCT FROM v_old.route_type THEN
    t_changed := array_append(t_changed, 'route_type'); END IF;
  IF p_departure_date      IS DISTINCT FROM v_old.departure_date THEN
    t_changed := array_append(t_changed, 'departure_date'); END IF;
  IF p_return_date         IS DISTINCT FROM v_old.return_date THEN
    t_changed := array_append(t_changed, 'return_date'); END IF;
  IF p_duration_days       IS NOT NULL AND p_duration_days       IS DISTINCT FROM v_old.duration_days THEN
    t_changed := array_append(t_changed, 'duration_days'); END IF;
  IF p_flexible_dates      IS NOT NULL AND p_flexible_dates      IS DISTINCT FROM v_old.flexible_dates THEN
    t_changed := array_append(t_changed, 'flexible_dates'); END IF;
  IF p_valid_from          IS NOT NULL AND p_valid_from          IS DISTINCT FROM v_old.valid_from THEN
    t_changed := array_append(t_changed, 'valid_from'); END IF;
  IF p_valid_until         IS NOT NULL AND p_valid_until         IS DISTINCT FROM v_old.valid_until THEN
    t_changed := array_append(t_changed, 'valid_until'); END IF;

  INSERT INTO public.admin_actions (actor_id, action_type, target_type, target_id, metadata)
  VALUES (
    auth.uid(),
    'OFFER_MAJOR_EDIT',
    'offer',
    v_new.id,
    jsonb_build_object(
      'before',
      jsonb_build_object(
        'price_amount', to_jsonb(v_old.price_amount),
        'currency',     to_jsonb(v_old.currency),
        'price_type',   to_jsonb(v_old.price_type),
        'price_basis',  to_jsonb(v_old.price_basis),
        'origin_city_id',      to_jsonb(v_old.origin_city_id),
        'destination_city_id', to_jsonb(v_old.destination_city_id),
        'origin_airport_id',   to_jsonb(v_old.origin_airport_id),
        'destination_airport_id', to_jsonb(v_old.destination_airport_id),
        'airline_id',          to_jsonb(v_old.airline_id),
        'route_type',          to_jsonb(v_old.route_type),
        'departure_date',      to_jsonb(v_old.departure_date),
        'return_date',         to_jsonb(v_old.return_date),
        'duration_days',       to_jsonb(v_old.duration_days),
        'flexible_dates',      to_jsonb(v_old.flexible_dates),
        'valid_from',          to_jsonb(v_old.valid_from),
        'valid_until',         to_jsonb(v_old.valid_until)
      ),
      'after',
      jsonb_build_object(
        'price_amount', to_jsonb(v_new.price_amount),
        'currency',     to_jsonb(v_new.currency),
        'price_type',   to_jsonb(v_new.price_type),
        'price_basis',  to_jsonb(v_new.price_basis),
        'origin_city_id',      to_jsonb(v_new.origin_city_id),
        'destination_city_id', to_jsonb(v_new.destination_city_id),
        'origin_airport_id',   to_jsonb(v_new.origin_airport_id),
        'destination_airport_id', to_jsonb(v_new.destination_airport_id),
        'airline_id',          to_jsonb(v_new.airline_id),
        'route_type',          to_jsonb(v_new.route_type),
        'departure_date',      to_jsonb(v_new.departure_date),
        'return_date',         to_jsonb(v_new.return_date),
        'duration_days',       to_jsonb(v_new.duration_days),
        'flexible_dates',      to_jsonb(v_new.flexible_dates),
        'valid_from',          to_jsonb(v_new.valid_from),
        'valid_until',         to_jsonb(v_new.valid_until)
      ),
      'changed_fields', to_jsonb(t_changed)
    )
  );
END;
$_major_$;

COMMIT;

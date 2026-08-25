-- ============================================================================
-- THE JOURNEY — Migration 0110: Functions & Triggers (server-side contracts)
-- Ratified rules enforced HERE, mechanically:
--   B1/C4 : CLOSED-WORLD offer transition whitelist — EXACTLY 11 legal pairs
--   B2    : review eligibility = responded ∧ responded_at + 90 days ≥ now()
--   B7    : new contact_requests only on PUBLISHED offers; existing requests
--           never lose rights due to later offer state
--   §2.8  : exact contact-request state causes/guards
--   §7    : derived fields maintained ONLY here — app code never writes them
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. OFFER TRANSITION WHITELIST — CLOSED WORLD (B1)
--    Exactly these pairs; ANYTHING else is rejected by construction.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.assert_offer_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- agent ownership is immutable
  IF NEW.agent_id IS DISTINCT FROM OLD.agent_id THEN
    RAISE EXCEPTION 'offers.agent_id is immutable';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status, NEW.status) IN (
        ('draft','pending_review'),            -- 1  submit
        ('pending_review','published'),        -- 2  approve (admin fn)
        ('pending_review','rejected'),         -- 3  reject (admin fn, reason)
        ('rejected','pending_review'),         -- 4  resubmit
        ('published','expired'),               -- 5  system job ONLY
        ('expired','pending_review'),          -- 6  renewal
        ('published','pending_review'),        -- 7  major-edit re-review (E2)
        ('draft','archived'),                  -- 8
        ('rejected','archived'),               -- 9
        ('expired','archived'),                -- 10
        ('published','archived')               -- 11 unpublish / admin archive
      )
    ) THEN
      RAISE EXCEPTION 'Illegal offer transition % -> % (closed-world whitelist, B1)', OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assert_offer_transition
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.assert_offer_transition();

-- ── Offer lifecycle functions (T1–T7 of DATABASE_DESIGN §4) ────────────────

-- T1: DRAFT → PENDING_REVIEW (owning agent)
CREATE OR REPLACE FUNCTION public.submit_own_offer(p_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent   uuid := public.current_agent_profile_id();
  v         public.offers%ROWTYPE;
BEGIN
  IF v_agent IS NULL THEN RAISE EXCEPTION 'not an agent account'; END IF;

  SELECT * INTO v FROM public.offers WHERE id = p_offer_id AND agent_id = v_agent;
  IF NOT FOUND THEN RAISE EXCEPTION 'offer not found for this agent'; END IF;
  IF v.status <> 'draft' THEN RAISE EXCEPTION 'invalid state: % (expected draft)', v.status; END IF;

  IF v.valid_until <= now() THEN RAISE EXCEPTION 'valid_until must be in the future'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.agent_profiles
    WHERE id = v_agent AND verification_status = 'verified'
  ) THEN RAISE EXCEPTION 'agent_not_verified: only verified agents may submit offers';
  END IF;

  -- No duplicate live offer: same agent/route/trip_type with overlapping validity (SPEC §5.2)
  IF EXISTS (
    SELECT 1 FROM public.offers o
    WHERE o.agent_id = v_agent
      AND o.id <> v.id
      AND o.origin_city_id = v.origin_city_id
      AND o.destination_city_id = v.destination_city_id
      AND o.trip_type = v.trip_type
      AND o.status IN ('pending_review', 'published')
      AND o.valid_from < v.valid_until
      AND o.valid_until > v.valid_from
  ) THEN
    RAISE EXCEPTION 'duplicate_live_offer: overlapping live offer exists for this route';
  END IF;

  UPDATE public.offers
  SET status = 'pending_review',
      submitted_at = now(),
      rejection_reason = NULL          -- cleared on resubmission path (T4 semantics)
  WHERE id = v.id;
END;
$$;

-- T2: PENDING_REVIEW → PUBLISHED (admin, server-side; ≤90-day publication cap)
CREATE OR REPLACE FUNCTION public.admin_approve_offer(p_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v public.offers%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;

  SELECT * INTO v FROM public.offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'offer not found'; END IF;
  IF v.status <> 'pending_review' THEN RAISE EXCEPTION 'invalid state: %', v.status; END IF;

  IF v.valid_until > now() + INTERVAL '90 days' THEN
    RAISE EXCEPTION 'publication cap violated: valid_until exceeds 90 days';
  END IF;

  UPDATE public.offers
  SET status = 'published', published_at = now()
  WHERE id = v.id;

  INSERT INTO public.admin_actions (actor_id, action_type, target_type, target_id)
  SELECT auth.uid(), 'OFFER_APPROVE', 'offer', v.id;

  INSERT INTO public.notifications (recipient_id, type, payload)
  SELECT a.user_id, 'offer.approved',
         jsonb_build_object('offer_id', v.id, 'title', v.title_ar)
  FROM public.agent_profiles a WHERE a.id = v.agent_id;
END;
$$;

-- T3: PENDING_REVIEW → REJECTED (admin; reason REQUIRED)
CREATE OR REPLACE FUNCTION public.admin_reject_offer(p_offer_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v public.offers%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'rejection_reason is required';
  END IF;

  SELECT * INTO v FROM public.offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'offer not found'; END IF;
  IF v.status <> 'pending_review' THEN RAISE EXCEPTION 'invalid state: %', v.status; END IF;

  UPDATE public.offers
  SET status = 'rejected', rejection_reason = btrim(p_reason)
  WHERE id = v.id;

  INSERT INTO public.admin_actions (actor_id, action_type, target_type, target_id, metadata)
  SELECT auth.uid(), 'OFFER_REJECT', 'offer', v.id,
         jsonb_build_object('reason', btrim(p_reason));

  INSERT INTO public.notifications (recipient_id, type, payload)
  SELECT a.user_id, 'offer.rejected',
         jsonb_build_object('offer_id', v.id, 'title', v.title_ar, 'reason', btrim(p_reason))
  FROM public.agent_profiles a WHERE a.id = v.agent_id;
END;
$$;

-- Archive: owner path (pairs #8/#9/#10/#11) or admin (any live state incl. #11)
CREATE OR REPLACE FUNCTION public.archive_offer(p_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v public.offers%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'offer not found'; END IF;
  IF v.status = 'archived' THEN RAISE EXCEPTION 'already archived'; END IF;

  IF public.is_admin() THEN
    -- admin may archive any state (logged)
    NULL;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.agent_profiles
                   WHERE id = v.agent_id AND user_id = auth.uid()) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    IF v.status NOT IN ('draft','rejected','expired','published') THEN
      RAISE EXCEPTION 'owner cannot archive from state %', v.status;
    END IF;
  END IF;

  UPDATE public.offers SET status = 'archived' WHERE id = v.id;

  IF public.is_admin() THEN
    INSERT INTO public.admin_actions (actor_id, action_type, target_type, target_id)
    VALUES (auth.uid(), 'OFFER_ARCHIVE', 'offer', v.id);
  END IF;
END;
$$;

-- T5: PUBLISHED → EXPIRED (system job ONLY — AD-09) + expiry notifications
CREATE OR REPLACE FUNCTION public.expire_published_offers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH exp AS (
    UPDATE public.offers
    SET status = 'expired', expired_at = now()
    WHERE status = 'published' AND valid_until < now()
    RETURNING id, agent_id, title_ar
  ), notified_agents AS (
    INSERT INTO public.notifications (recipient_id, type, payload)
    SELECT a.user_id, 'offer.expired',
           jsonb_build_object('offer_id', e.id, 'title', e.title_ar)
    FROM exp e JOIN public.agent_profiles a ON a.id = e.agent_id
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM notified_agents;
  RETURN v_count;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. CONTACT REQUESTS (§2.8 exact causes + B7)
-- ════════════════════════════════════════════════════════════════════════════

-- Denormalized anchor integrity (ERD mechanism 3): agent_id always = offer.agent_id
CREATE OR REPLACE FUNCTION public.contact_force_anchor()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT o.agent_id INTO NEW.agent_id FROM public.offers o WHERE o.id = NEW.offer_id;
  IF NEW.agent_id IS NULL THEN RAISE EXCEPTION 'offer not found'; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contact_force_agent
  BEFORE INSERT ON public.contact_requests
  FOR EACH ROW EXECUTE FUNCTION public.contact_force_anchor();

CREATE OR REPLACE FUNCTION public.contact_immutable_links()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.offer_id IS DISTINCT FROM OLD.offer_id
     OR NEW.traveler_id IS DISTINCT FROM OLD.traveler_id
     OR NEW.agent_id IS DISTINCT FROM OLD.agent_id THEN
    RAISE EXCEPTION 'contact_requests links are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contact_immutable_links
  BEFORE UPDATE ON public.contact_requests
  FOR EACH ROW EXECUTE FUNCTION public.contact_immutable_links();

-- Traveler creates a request — ONLY against PUBLISHED offers (B7 creation gate).
CREATE OR REPLACE FUNCTION public.create_contact_request(
  p_offer_id uuid,
  p_message text,
  p_traveler_count integer DEFAULT 1,
  p_travel_dates_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_offer public.offers%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_message IS NULL OR char_length(btrim(p_message)) < 10 THEN
    RAISE EXCEPTION 'message too short (min 10 chars)';
  END IF;

  SELECT * INTO v_offer FROM public.offers WHERE id = p_offer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'offer not found'; END IF;
  IF v_offer.status <> 'published' OR v_offer.valid_until < now() THEN
    RAISE EXCEPTION 'offer_not_published';     -- B7: creation gated on live offers
  END IF;

  IF EXISTS (SELECT 1 FROM public.contact_requests
             WHERE traveler_id = v_uid AND offer_id = p_offer_id
               AND status IN ('new','viewed')) THEN
    RAISE EXCEPTION 'duplicate_active_request';
  END IF;

  INSERT INTO public.contact_requests
    (offer_id, traveler_id, agent_id, message, traveler_count, travel_dates_note, is_demo)
  VALUES
    (p_offer_id, v_uid, v_offer.agent_id, btrim(p_message),
     GREATEST(coalesce(p_traveler_count, 1), 1), p_travel_dates_note, false)
  RETURNING id INTO v_id;

  -- notify agent: new customer interest (SPEC §4.5)
  INSERT INTO public.notifications (recipient_id, type, payload)
  SELECT a.user_id, 'contact.received',
         jsonb_build_object('contact_request_id', v_id,
                            'offer_title', v_offer.title_ar,
                            'traveler_name', (SELECT display_name FROM public.users WHERE id = v_uid))
  FROM public.agent_profiles a WHERE a.id = v_offer.agent_id;

  RETURN v_id;
END;
$$;

-- Agent marks viewed — once, from 'new' (idempotent on 'viewed')
CREATE OR REPLACE FUNCTION public.mark_contact_viewed(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status public.enum_contact_status;
BEGIN
  -- NOTE: never consults offer.status — existing requests retain rights after
  -- expiry/archive (B7). Same applies to respond/close/cancel below.
  IF public.current_agent_profile_id() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT status INTO v_status FROM public.contact_requests
  WHERE id = p_request_id AND agent_id = public.current_agent_profile_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;

  IF v_status = 'new' THEN
    UPDATE public.contact_requests SET status='viewed', viewed_at=now() WHERE id=p_request_id;
  ELSIF v_status <> 'viewed' THEN
    RAISE EXCEPTION 'invalid state: %', v_status;
  END IF;
END;
$$;

-- Agent responds — grants traveler review eligibility (C3 anchor event)
CREATE OR REPLACE FUNCTION public.respond_to_contact(p_request_id uuid, p_response text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.contact_requests%ROWTYPE;
BEGIN
  IF p_response IS NULL OR char_length(btrim(p_response)) = 0 THEN
    RAISE EXCEPTION 'response message required';
  END IF;

  SELECT * INTO v FROM public.contact_requests
  WHERE id = p_request_id AND agent_id = public.current_agent_profile_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF v.status NOT IN ('new','viewed') THEN RAISE EXCEPTION 'invalid state: %', v.status; END IF;

  UPDATE public.contact_requests
  SET status='responded', response_message=btrim(p_response), responded_at=now()
  WHERE id = v.id;

  INSERT INTO public.notifications (recipient_id, type, payload)
  SELECT traveler_id, 'contact.responded',
         jsonb_build_object('contact_request_id', v.id)
  FROM public.contact_requests c WHERE c.id = v.id;
END;
$$;

-- Traveler closes after response (terminal)
CREATE OR REPLACE FUNCTION public.close_contact(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v public.contact_requests%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.contact_requests
  WHERE id = p_request_id AND traveler_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF v.status <> 'responded' THEN RAISE EXCEPTION 'invalid state: %', v.status; END IF;

  UPDATE public.contact_requests SET status='closed', closed_at=now() WHERE id = v.id;
END;
$$;

-- Traveler cancels while new/viewed (terminal)
CREATE OR REPLACE FUNCTION public.cancel_contact(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v public.contact_requests%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.contact_requests
  WHERE id = p_request_id AND traveler_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF v.status NOT IN ('new','viewed') THEN RAISE EXCEPTION 'invalid state: %', v.status; END IF;

  UPDATE public.contact_requests SET status='cancelled' WHERE id = v.id;
END;
$$;

-- Job (AD-09): auto-close RESPONDED after 30 silent days
CREATE OR REPLACE FUNCTION public.auto_close_responded_contacts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.contact_requests
  SET status='closed', closed_at=now()
  WHERE status='responded' AND responded_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. REVIEWS — eligibility function + independent double-check trigger (B2/C3)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.submit_review(
  p_contact_request_id uuid,
  p_rating smallint,
  p_content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.contact_requests%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_req FROM public.contact_requests WHERE id = p_contact_request_id;
  IF NOT FOUND OR v_req.traveler_id <> v_uid THEN RAISE EXCEPTION 'not found'; END IF;

  -- ★ RATIFIED ELIGIBILITY RULE (C3 + B2): server-side, never UI-only
  IF v_req.status <> 'responded' THEN
    RAISE EXCEPTION 'review_not_eligible: agent has not responded';
  END IF;
  IF v_req.responded_at + INTERVAL '90 days' < now() THEN
    RAISE EXCEPTION 'review_window_expired: eligibility ends 90 days after agent response';
  END IF;

  INSERT INTO public.reviews (contact_request_id, author_id, agent_id, rating, content, is_demo)
  VALUES (v_req.id, v_uid, v_req.agent_id, p_rating, btrim(p_content), false)
  RETURNING id INTO v_id;

  -- thank/notify agent
  INSERT INTO public.notifications (recipient_id, type, payload)
  SELECT a.user_id, 'review.new',
         jsonb_build_object('review_id', v_id, 'rating', p_rating)
  FROM public.agent_profiles a WHERE a.id = v_req.agent_id;

  RETURN v_id;
END;
$$;

-- Independent double-check — fires on EVERY insert, including definer contexts.
CREATE OR REPLACE FUNCTION public.validate_review_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE r public.contact_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.contact_requests WHERE id = NEW.contact_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'review anchor request missing'; END IF;
  IF NEW.author_id <> r.traveler_id THEN RAISE EXCEPTION 'review author mismatch'; END IF;
  IF NEW.agent_id  <> r.agent_id    THEN RAISE EXCEPTION 'review agent mismatch';  END IF;
  IF r.status <> 'responded' THEN
    RAISE EXCEPTION 'review_not_eligible: interaction not responded';
  END IF;
  IF r.responded_at + INTERVAL '90 days' < now() THEN
    RAISE EXCEPTION 'review_window_expired (B2)';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_review_insert
  BEFORE INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.validate_review_insert();

-- Derived read-model maintenance (§7): visible-review aggregates
CREATE OR REPLACE FUNCTION public.refresh_agent_review_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_agent uuid := coalesce(NEW.agent_id, OLD.agent_id);
BEGIN
  UPDATE public.agent_profiles p
  SET avg_rating    = sub.avg_rating,
      reviews_count = sub.reviews_count
  FROM (
    SELECT COALESCE(ROUND(AVG(rating) FILTER (WHERE is_visible), 2), 0) AS avg_rating,
           COUNT(*) FILTER (WHERE is_visible)                            AS reviews_count
    FROM public.reviews WHERE agent_id = v_agent
  ) sub
  WHERE p.id = v_agent;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_reviews_stats
  AFTER INSERT OR DELETE OR UPDATE OF is_visible ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.refresh_agent_review_stats();

-- Published-offers counter maintenance
CREATE OR REPLACE FUNCTION public.refresh_agent_published_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_agent uuid := coalesce(NEW.agent_id, OLD.agent_id);
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR TG_OP = 'INSERT' THEN
    UPDATE public.agent_profiles p
    SET published_offers_count = (
      SELECT count(*) FROM public.offers o
      WHERE o.agent_id = v_agent AND o.status = 'published'
    )
    WHERE p.id = v_agent;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_agent_published_count
  AFTER UPDATE OF status ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.refresh_agent_published_count();

-- Contact counter (total received — insert-only semantics)
CREATE OR REPLACE FUNCTION public.bump_offer_contact_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.offers SET contact_count = contact_count + 1 WHERE id = NEW.offer_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_bump_contact_count
  AFTER INSERT ON public.contact_requests
  FOR EACH ROW EXECUTE FUNCTION public.bump_offer_contact_count();

-- ════════════════════════════════════════════════════════════════════════════
-- 4. IDENTITY: signup mirror + verification decisions + suspension
-- ════════════════════════════════════════════════════════════════════════════

-- auth.users → public.users mirror. Role whitelist makes admin-via-signup impossible.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, role, display_name, language_pref)
  VALUES (
    NEW.id,
    CASE NEW.raw_user_meta_data ->> 'role' WHEN 'agent' THEN 'agent'::public.enum_user_role
                                           ELSE 'traveler'::public.enum_user_role END,
    COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'display_name'), ''),
             left(split_part(coalesce(NEW.email, 'user'), '@', 1), 80),
             'مستخدم'),
    CASE NEW.raw_user_meta_data ->> 'language' WHEN 'en' THEN 'en'::public.enum_locale
                                               ELSE 'ar'::public.enum_locale END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Verification decisions (admin; SLA + reasons per SPEC §4.3)
CREATE OR REPLACE FUNCTION public.admin_decide_verification(
  p_request_id uuid,
  p_approved boolean,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.verification_requests%ROWTYPE;
  v_profile public.agent_profiles%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;
  IF NOT p_approved AND (p_note IS NULL OR char_length(btrim(p_note)) = 0) THEN
    RAISE EXCEPTION 'decision_note is required when rejecting';
  END IF;

  SELECT * INTO v FROM public.verification_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF v.status <> 'in_review' THEN RAISE EXCEPTION 'invalid state: %', v.status; END IF;

  UPDATE public.verification_requests
  SET status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END::public.enum_verification_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      decision_note = p_note
  WHERE id = v.id;

  SELECT * INTO v_profile FROM public.agent_profiles WHERE id = v.agent_id;

  IF p_approved THEN
    UPDATE public.agent_profiles
    SET verification_status = 'verified', verified_at = now()
    WHERE id = v.agent_id
      AND verification_status IN ('unverified', 'in_review', 'rejected');
  ELSE
    UPDATE public.agent_profiles
    SET verification_status = 'rejected'
    WHERE id = v.agent_id AND verification_status = 'in_review';
  END IF;

  INSERT INTO public.admin_actions (actor_id, action_type, target_type, target_id, metadata)
  VALUES (auth.uid(),
          CASE WHEN p_approved THEN 'VERIFICATION_APPROVE' ELSE 'VERIFICATION_REJECT' END,
          'verification_request', v.id,
          jsonb_build_object('note', p_note));

  INSERT INTO public.notifications (recipient_id, type, payload)
  SELECT u.id,
         CASE WHEN p_approved THEN 'verification.approved' ELSE 'verification.rejected' END,
         jsonb_build_object('request_id', v.id, 'note', p_note)
  FROM public.users u WHERE u.id = v_profile.user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_agent_suspension(p_agent_id uuid, p_suspended boolean, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;

  SELECT user_id INTO v_user FROM public.agent_profiles WHERE id = p_agent_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'agent not found'; END IF;

  UPDATE public.agent_profiles
  SET verification_status = CASE WHEN p_suspended THEN 'suspended' ELSE 'verified' END::public.enum_agent_verification
  WHERE id = p_agent_id
    AND (CASE WHEN p_suspended THEN verification_status NOT IN ('suspended')
              ELSE verification_status = 'suspended' END);

  INSERT INTO public.admin_actions (actor_id, action_type, target_type, target_id, metadata)
  VALUES (auth.uid(), CASE WHEN p_suspended THEN 'AGENT_SUSPEND' ELSE 'AGENT_REINSTATE' END,
          'agent_profile', p_agent_id, jsonb_build_object('reason', p_reason));
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. JOBS SUPPORT (AD-09 schedules land in 0200)
-- ════════════════════════════════════════════════════════════════════════════

-- Expiry reminders: 7d / 1d buckets for agents + saved-offer holders (deduped)
CREATE OR REPLACE FUNCTION public.send_expiry_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_sent integer;
BEGIN
  WITH targets AS (
    SELECT o.id, o.agent_id, o.title_ar, o.valid_until,
           CASE
             WHEN o.valid_until BETWEEN now() + INTERVAL '6 days' AND now() + INTERVAL '7 days'
               THEN 'offer.expiring_7d'
             WHEN o.valid_until BETWEEN now() AND now() + INTERVAL '1 day'
               THEN 'offer.expiring_1d'
           END AS reminder_type
    FROM public.offers o
    WHERE o.status = 'published'
      AND (o.valid_until BETWEEN now() + INTERVAL '6 days' AND now() + INTERVAL '7 days'
           OR o.valid_until BETWEEN now() AND now() + INTERVAL '1 day')
  ),
  ins AS (
    INSERT INTO public.notifications (recipient_id, type, payload)
    SELECT a.user_id, t.reminder_type,
           jsonb_build_object('offer_id', t.id, 'title', t.title_ar, 'valid_until', t.valid_until)
    FROM targets t
    JOIN public.agent_profiles a ON a.id = t.agent_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_id = a.user_id
        AND n.type = t.reminder_type
        AND n.payload ->> 'offer_id' = t.id::text
    )
    RETURNING 1
  ),
  saved_ins AS (
    INSERT INTO public.notifications (recipient_id, type, payload)
    SELECT s.traveler_id, 'saved_offer.expiring',
           jsonb_build_object('offer_id', t.id, 'title', t.title_ar, 'valid_until', t.valid_until)
    FROM targets t
    JOIN public.saved_offers s ON s.offer_id = t.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_id = s.traveler_id
        AND n.type = 'saved_offer.expiring'
        AND n.payload ->> 'offer_id' = t.id::text
    )
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM ins) + (SELECT count(*) FROM saved_ins) INTO v_sent;
  RETURN v_sent;
END;
$$;

-- Response-rate read-model over rolling 90d — computed ONLY with ≥5 samples
-- (audit rule: never display trust metrics built on thin data).
CREATE OR REPLACE FUNCTION public.recompute_response_metrics()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_updated integer;
BEGIN
  UPDATE public.agent_profiles p
  SET response_rate_pct  = s.rate,
      avg_response_hours = round(s.avg_h::numeric, 1)
  FROM (
    SELECT cr.agent_id,
           ROUND(
             100.0 * COUNT(cr.responded_at) FILTER (
               WHERE cr.responded_at IS NOT NULL
                 AND cr.responded_at - cr.created_at <= INTERVAL '48 hours'
             ) / NULLIF(COUNT(*), 0)
           )::smallint AS rate,
           AVG(EXTRACT(EPOCH FROM (cr.responded_at - cr.created_at)) / 3600.0)
             FILTER (WHERE cr.responded_at IS NOT NULL) AS avg_h
    FROM public.contact_requests cr
    WHERE cr.created_at >= now() - INTERVAL '90 days'
      AND cr.is_demo = false
    GROUP BY cr.agent_id
    HAVING COUNT(*) >= 5
  ) s
  WHERE p.id = s.agent_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. DEMO PURGE (AD-12): production MUST hold zero demo rows.
--    Real activity referencing demo data BLOCKS deletion (reported, never cascaded silently).
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.purge_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocked integer;
  v_n integer := 0; v_r integer := 0; v_c integer := 0; v_s integer := 0;
  v_m integer := 0; v_o integer := 0; v_ab integer := 0;
  v_vd integer := 0; v_vr integer := 0; v_ap integer := 0; v_u integer := 0;
BEGIN
  -- Gate: real (non-demo) travelers interacting with demo offers
  SELECT count(*) INTO v_blocked
  FROM public.contact_requests cr
  JOIN public.users u ON u.id = cr.traveler_id
  WHERE cr.is_demo = false AND u.is_demo = false
    AND cr.offer_id IN (SELECT id FROM public.offers WHERE is_demo);

  IF v_blocked > 0 THEN
    RAISE EXCEPTION 'purge blocked: % real-activity records reference demo data — resolve manually', v_blocked;
  END IF;

  DELETE FROM public.notifications n USING public.users u
    WHERE n.recipient_id = u.id AND (n.is_demo OR u.is_demo);
  GET DIAGNOSTICS v_n = ROW_COUNT;

  DELETE FROM public.reviews       WHERE is_demo; GET DIAGNOSTICS v_r  = ROW_COUNT;
  DELETE FROM public.contact_requests WHERE is_demo; GET DIAGNOSTICS v_c = ROW_COUNT;
  DELETE FROM public.saved_offers  WHERE is_demo; GET DIAGNOSTICS v_s  = ROW_COUNT;
  DELETE FROM public.offer_media   WHERE is_demo; GET DIAGNOSTICS v_m  = ROW_COUNT;
  DELETE FROM public.offers        WHERE is_demo; GET DIAGNOSTICS v_o  = ROW_COUNT;
  DELETE FROM public.agent_badges  WHERE is_demo; GET DIAGNOSTICS v_ab = ROW_COUNT;
  DELETE FROM public.verification_documents vd USING public.verification_requests vr
    WHERE vd.request_id = vr.id AND (vd.is_demo OR vr.is_demo);
  GET DIAGNOSTICS v_vd = ROW_COUNT;
  DELETE FROM public.verification_requests WHERE is_demo; GET DIAGNOSTICS v_vr = ROW_COUNT;
  DELETE FROM public.agent_profiles WHERE is_demo; GET DIAGNOSTICS v_ap = ROW_COUNT;

  -- Demo users: remove auth credentials (cascades the mirror row) when the
  -- auth schema exists (Supabase); otherwise remove mirror rows only.
  IF to_regclass('auth.users') IS NOT NULL THEN
    DELETE FROM auth.users WHERE id IN (SELECT id FROM public.users WHERE is_demo);
    GET DIAGNOSTICS v_u = ROW_COUNT;
  ELSE
    DELETE FROM public.users WHERE is_demo;
    GET DIAGNOSTICS v_u = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'notifications', v_n, 'reviews', v_r, 'contact_requests', v_c,
    'saved_offers', v_s, 'offer_media', v_m, 'offers', v_o,
    'agent_badges', v_ab, 'verification_documents', v_vd,
    'verification_requests', v_vr, 'agent_profiles', v_ap, 'users', v_u
  );
END;
$$;

COMMIT;

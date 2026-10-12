-- ============================================================================
-- THE JOURNEY — Migration 0100: RLS & Authorization Model
-- Canonical source: DATABASE_DESIGN.md §5 (permission matrix), §6 (RLS model)
-- Principles (AD-05): RLS-first; public surfaces read projection views only;
-- privileged mutations run through server-side definer functions (0110);
-- service-role bypasses RLS and is confined to audited server contexts.
-- ============================================================================

BEGIN;

-- ── Enable RLS on every table ───────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','agent_profiles','verification_requests','verification_documents',
    'countries','cities','airports','airlines','badges',
    'offers','offer_media','contact_requests',
    'reviews','agent_badges','notifications','saved_offers','reports','admin_actions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    -- Force-by-default: tables WITHOUT at least one permissive policy deny everyone
    -- except table owner / service-role. This is the intended baseline.
  END LOOP;
END $$;

-- ── users: self read/update(safe cols) — role immutable to self ────────────
REVOKE ALL ON public.users FROM anon, authenticated;
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (display_name, phone, language_pref) ON public.users TO authenticated;
CREATE POLICY users_select_own   ON public.users FOR SELECT USING (id = auth.uid());
-- role/is_active protected by the COLUMN-LEVEL grant above (not by a self-referencing
-- subquery, which would trigger infinite policy recursion).
CREATE POLICY users_update_own   ON public.users FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── agent_profiles: owner reads/edits CONTENT columns; status/metrics system-only
REVOKE ALL ON public.agent_profiles FROM anon, authenticated;
GRANT SELECT ON public.agent_profiles TO authenticated;
GRANT UPDATE (
  display_name, business_name, bio_ar, bio_en, photo_url, city_id,
  license_type, license_number, specialty_tags, languages_spoken
) ON public.agent_profiles TO authenticated;
CREATE POLICY agent_select_own ON public.agent_profiles FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY agent_update_own_content ON public.agent_profiles FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── verification_requests: agent submits own attempt; transitions via SR fns
REVOKE ALL ON public.verification_requests FROM anon, authenticated;
GRANT SELECT, INSERT ON public.verification_requests TO authenticated;
CREATE POLICY vreq_select_own ON public.verification_requests FOR SELECT
  USING (agent_id = public.current_agent_profile_id());
CREATE POLICY vreq_insert_own_inreview ON public.verification_requests FOR INSERT
  WITH CHECK (
    agent_id = public.current_agent_profile_id() AND status = 'in_review'
  );

-- ── verification_documents: STRICTEST (AD-06) — signed URLs issued server-side
REVOKE ALL ON public.verification_documents FROM anon, authenticated;
GRANT SELECT, INSERT ON public.verification_documents TO authenticated;
CREATE POLICY vdoc_select_own ON public.verification_documents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.verification_requests r
    WHERE r.id = request_id AND r.agent_id = public.current_agent_profile_id()
  ));
CREATE POLICY vdoc_insert_into_own_inreview ON public.verification_documents FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.verification_requests r
    WHERE r.id = request_id
      AND r.agent_id = public.current_agent_profile_id()
      AND r.status = 'in_review'
  ));

-- ── reference data: public read of ACTIVE rows; writes admin tooling (SR) ──
REVOKE ALL ON public.countries FROM anon, authenticated;
GRANT SELECT ON public.countries TO anon, authenticated;
CREATE POLICY countries_read_active ON public.countries FOR SELECT USING (is_active);

REVOKE ALL ON public.cities FROM anon, authenticated;
GRANT SELECT ON public.cities TO anon, authenticated;
CREATE POLICY cities_read_active ON public.cities FOR SELECT USING (is_active);

REVOKE ALL ON public.airports FROM anon, authenticated;
GRANT SELECT ON public.airports TO anon, authenticated;
CREATE POLICY airports_read_active ON public.airports FOR SELECT USING (is_active);

REVOKE ALL ON public.airlines FROM anon, authenticated;
GRANT SELECT ON public.airlines TO anon, authenticated;
CREATE POLICY airlines_read_active ON public.airlines FOR SELECT USING (is_active);

REVOKE ALL ON public.badges FROM anon, authenticated;
GRANT SELECT ON public.badges TO anon, authenticated;
CREATE POLICY badges_read_active ON public.badges FOR SELECT USING (is_active);

REVOKE ALL ON public.agent_badges FROM anon, authenticated;
GRANT SELECT ON public.agent_badges TO anon, authenticated;
CREATE POLICY agent_badges_read_active ON public.agent_badges FOR SELECT
  USING (revoked_at IS NULL);

-- ── offers: owner CRUD-within-rules; PUBLIC READ ONLY VIA VIEW (§6) ────────
REVOKE ALL ON public.offers FROM anon, authenticated;
GRANT SELECT, INSERT ON public.offers TO authenticated;
CREATE POLICY offers_select_own ON public.offers FOR SELECT
  USING (agent_id = public.current_agent_profile_id());
CREATE POLICY offers_insert_own_draft ON public.offers FOR INSERT
  WITH CHECK (
    agent_id = public.current_agent_profile_id()
    AND status = 'draft'
    AND is_demo = false
  );
-- NOTE: no UPDATE grant — all state changes flow through whitelisted functions (B1).
-- NOTE: no DELETE grant anywhere — archive is the terminal path.

REVOKE ALL ON public.offer_media FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.offer_media TO authenticated;
CREATE POLICY om_select_own ON public.offer_media FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.offers o
                WHERE o.id = offer_id AND o.agent_id = public.current_agent_profile_id()));
CREATE POLICY om_insert_own ON public.offer_media FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.offers o
                WHERE o.id = offer_id AND o.agent_id = public.current_agent_profile_id()));
CREATE POLICY om_delete_own ON public.offer_media FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.offers o
                WHERE o.id = offer_id AND o.agent_id = public.current_agent_profile_id()));

-- ── contact_requests: participant-read; DML exclusively via functions (§2.8/B7)
REVOKE ALL ON public.contact_requests FROM anon, authenticated;
GRANT SELECT ON public.contact_requests TO authenticated;
CREATE POLICY contact_select_participant ON public.contact_requests FOR SELECT
  USING (
    traveler_id = auth.uid()
    OR agent_id = public.current_agent_profile_id()
  );
-- Existing requests remain fully operable regardless of later offer state (B7):
-- the respond/view/close functions in 0110 never consult offer.status.

-- ── reviews: public read of VISIBLE rows; insert ONLY via eligibility fn (B2)
REVOKE ALL ON public.reviews FROM anon, authenticated;
GRANT SELECT ON public.reviews TO anon, authenticated;
CREATE POLICY reviews_read_visible ON public.reviews FOR SELECT USING (is_visible);

-- ── notifications: recipient-only; inserts by system definer functions ─────
REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
CREATE POLICY notif_select_recipient ON public.notifications FOR SELECT
  USING (recipient_id = auth.uid());
CREATE POLICY notif_mark_read ON public.notifications FOR UPDATE
  USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

-- ── saved_offers: owner CRUD; target must be published at save time (§3.16)
REVOKE ALL ON public.saved_offers FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.saved_offers TO authenticated;
CREATE POLICY saved_select_own ON public.saved_offers FOR SELECT
  USING (traveler_id = auth.uid());
CREATE POLICY saved_insert_own_published ON public.saved_offers FOR INSERT
  WITH CHECK (
    traveler_id = auth.uid()
    AND is_demo = false
    AND EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_id AND o.status = 'published' AND o.valid_until >= now()
    )
  );
CREATE POLICY saved_delete_own ON public.saved_offers FOR DELETE
  USING (traveler_id = auth.uid());

-- ── reports: reporter files & reads OWN; handling via SR ────────────────────
REVOKE ALL ON public.reports FROM anon, authenticated;
GRANT SELECT, INSERT ON public.reports TO authenticated;
CREATE POLICY reports_select_own ON public.reports FOR SELECT
  USING (reporter_id = auth.uid());
CREATE POLICY reports_insert_auth ON public.reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid() AND is_demo = false);

-- ── admin_actions: append-only; NO client access whatsoever (§6) ───────────
REVOKE ALL ON public.admin_actions FROM anon, authenticated;
-- No policies → RLS denies anon/authenticated entirely.
-- Service-role (server-side) bypasses RLS for audited inserts; admin SELECT
-- exposure lands with the admin portal slice via a dedicated definer view.

-- ============================================================================
-- PUBLIC PROJECTION VIEWS (§6 standing rule 3 — deliberately security-definer:
-- owned by the migrating role which bypasses RLS; underlying tables get NO anon grants)
-- Defense-in-depth demo filtering included per B9 — primary guarantee remains
-- production cleanliness + purge gate (AD-12).
-- ============================================================================

-- Public agent profiles: VERIFIED agents only.
CREATE VIEW public.public_agent_profiles WITH (security_barrier = true) AS
SELECT
  p.id,
  p.display_name,
  p.business_name,
  p.bio_ar,
  p.bio_en,
  p.photo_url,
  p.city_id,
  c.name_ar  AS city_name_ar,
  c.name_en  AS city_name_en,
  p.license_type,
  p.specialty_tags,
  p.languages_spoken,
  p.joined_at,
  p.avg_rating,
  p.reviews_count,
  p.published_offers_count,
  p.response_rate_pct,
  p.avg_response_hours
FROM public.agent_profiles p
LEFT JOIN public.cities c ON c.id = p.city_id
WHERE p.verification_status = 'verified'
  AND p.is_demo = false;

GRANT SELECT ON public.public_agent_profiles TO anon, authenticated;

-- Public offers: PUBLISHED ∧ within validity ∧ agent VERIFIED.
CREATE VIEW public.public_offers WITH (security_barrier = true) AS
SELECT
  o.id,
  o.title_ar,
  o.title_en,
  o.description_ar,
  o.description_en,
  o.trip_type,
  o.route_type,
  o.origin_city_id,
  oc.name_ar AS origin_city_ar,
  oc.name_en AS origin_city_en,
  o.destination_city_id,
  dc.name_ar AS destination_city_ar,
  dc.name_en AS destination_city_en,
  oa.iata    AS origin_airport_iata,
  da.iata    AS destination_airport_iata,
  o.airline_id,
  al.name_ar AS airline_name_ar,
  al.name_en AS airline_name_en,
  al.iata    AS airline_iata,
  o.departure_date,
  o.return_date,
  o.duration_days,
  o.flexible_dates,
  o.price_amount,
  o.currency,
  o.price_type,
  o.price_basis,
  o.includes,
  o.excludes,
  o.min_travelers,
  o.max_travelers,
  o.valid_from,
  o.valid_until,
  o.published_at,
  o.agent_id,
  a.display_name       AS agent_display_name,
  a.avg_rating         AS agent_avg_rating,
  a.reviews_count      AS agent_reviews_count,
  a.response_rate_pct  AS agent_response_rate_pct,
  a.verified_at        AS agent_verified_at
FROM public.offers o
JOIN public.cities   oc ON oc.id = o.origin_city_id
JOIN public.cities   dc ON dc.id = o.destination_city_id
LEFT JOIN public.airports oa ON oa.id = o.origin_airport_id
LEFT JOIN public.airports da ON da.id = o.destination_airport_id
LEFT JOIN public.airlines  al ON al.id = o.airline_id
JOIN public.agent_profiles a  ON a.id = o.agent_id
WHERE o.status = 'published'
  AND o.valid_until >= now()
  AND a.verification_status = 'verified'
  AND o.is_demo = false;

GRANT SELECT ON public.public_offers TO anon, authenticated;

-- Visible reviews with Q3-ratified reviewer display: first name + family initial ("Ahmed M.").
CREATE VIEW public.visible_reviews_with_author WITH (security_barrier = true) AS
SELECT
  r.id,
  r.agent_id,
  r.rating,
  r.content,
  r.is_verified_transaction,
  r.created_at,
  CASE
    WHEN position(' ' IN u.display_name) > 0
      THEN split_part(u.display_name, ' ', 1) || ' ' ||
           upper(left(split_part(u.display_name, ' ', 2), 1)) || '.'
    ELSE u.display_name
  END AS reviewer_name
FROM public.reviews r
JOIN public.users u ON u.id = r.author_id
WHERE r.is_visible
  AND r.is_demo = false;

GRANT SELECT ON public.visible_reviews_with_author TO anon, authenticated;

COMMIT;

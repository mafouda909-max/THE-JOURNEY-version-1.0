-- ============================================================================
-- STAGING-ONLY PROVISIONING — Demo preview projections (AD-17 deviation #8)
--
-- ⛔ NEVER include this file in db/migrations/ and NEVER run it against
--   production. It exists solely for the STAGING Supabase project
--   (kmlsyyqmzgcmethgoglj) to let traveler-facing surfaces discover
--   clearly-marked demo fixtures during Slice 1 exit testing.
--
-- Contract (hardened Option A):
--   * Same columns/gates as canonical public_offers / public_agent_profiles:
--       PUBLISHED ∧ valid_until >= now() ∧ agent VERIFIED
--   * INVERTED demo filter: rows MUST have is_demo = true, so these views are
--     structurally incapable of exposing real/non-demo data anywhere.
--   * Definer-owned (created by the migrations/postgres role), consistent with
--     the canonical security-definer projections (DATABASE_DESIGN §6 rule 3).
--   * Canonical public_offers / public_agent_profiles are NOT touched.
--   * Harmless-by-construction if ever misapplied elsewhere: the launch gate
--     (zero demo rows in production) renders these views permanently empty.
--
-- Application wiring: src/lib/data/offers.ts + src/lib/data/agents.ts resolve
-- these names only when NEXT_PUBLIC_DEMO_PREVIEW=true AND the build is not a
-- production build (hard guard).
-- ============================================================================

BEGIN;

-- ── Demo-only offers projection ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.public_offers_staging WITH (security_barrier = true) AS
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
  AND o.is_demo = true;          -- INVERTED vs canonical: demo fixtures ONLY

GRANT SELECT ON public.public_offers_staging TO anon, authenticated;

COMMENT ON VIEW public.public_offers_staging IS
  'STAGING-ONLY demo preview (AD-17 #8). Identical contract to public_offers except restricted to is_demo = true rows. Never create in production; never referenced by production builds (hard guard in src/lib/data).';

-- ── Demo-only agent-profile projection ──────────────────────────────────────
CREATE OR REPLACE VIEW public.public_agent_profiles_staging WITH (security_barrier = true) AS
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
  AND p.is_demo = true;          -- INVERTED vs canonical: demo fixtures ONLY

GRANT SELECT ON public.public_agent_profiles_staging TO anon, authenticated;

COMMENT ON VIEW public.public_agent_profiles_staging IS
  'STAGING-ONLY demo preview (AD-17 #8). Identical contract to public_agent_profiles except restricted to is_demo = true rows. Never create in production; never referenced by production builds (hard guard in src/lib/data).';

COMMIT;

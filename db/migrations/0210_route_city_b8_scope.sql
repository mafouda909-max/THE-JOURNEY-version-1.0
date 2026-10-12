-- ============================================================================
-- THE JOURNEY — Migration 0210: Route-city distinctness scoped per B8
--
-- WHY: Migration 0030 shipped `chk_offers_route_cities_distinct` as an
-- UNCONDITIONAL CHECK (origin_city_id <> destination_city_id). The ratified
-- Representative-city rule (B8, DATABASE_DESIGN §2.5) grants same-city
-- routing ONLY to VISA and CUSTOM offers ("agents select a logical
-- representative city"). Hotel/cruise fixtures that used same-city routes
-- have NO canonical basis (AD-17 deviation #7) and remain forbidden.
--
-- This migration replaces the over-broad constraint with the exact B8
-- semantics WITHOUT touching immutable migration 0030. Table is empty at
-- time of writing (fresh staging), so revalidation is instant and total.
--
-- REVERSIBILITY: inverse operation =
--   ALTER TABLE public.offers DROP CONSTRAINT chk_offers_route_cities_distinct_b8;
--   ALTER TABLE public.offers ADD CONSTRAINT chk_offers_route_cities_distinct
--     CHECK (origin_city_id <> destination_city_id);
-- ============================================================================

BEGIN;

ALTER TABLE public.offers
  DROP CONSTRAINT chk_offers_route_cities_distinct;

ALTER TABLE public.offers
  ADD CONSTRAINT chk_offers_route_cities_distinct_b8
  CHECK (
    origin_city_id <> destination_city_id
    OR trip_type IN ('visa', 'custom')
  );

COMMENT ON CONSTRAINT chk_offers_route_cities_distinct_b8 ON public.offers IS
  'B8 (DATABASE_DESIGN §2.5): representative-city routing allowed ONLY for visa/custom; all other trip types require distinct origin/destination cities. Scoped replacement for the unconditional 0030 check.';

COMMIT;

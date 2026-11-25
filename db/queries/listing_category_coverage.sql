-- SILA listing category coverage audit
-- PREVIEW / TEST ONLY. This query reads aggregate counts and does not return traveler data.
-- Runs inside a read-only transaction; do not remove the transaction mode.

BEGIN TRANSACTION READ ONLY;

-- 1. Shared-field coverage by current listing category.
SELECT
  trip_type,
  COUNT(*)::INTEGER AS total_offers,
  COUNT(*) FILTER (WHERE status = 'published')::INTEGER AS published_offers,
  COUNT(DISTINCT agent_id)::INTEGER AS distinct_agent_profiles,
  COUNT(*) FILTER (WHERE NULLIF(BTRIM(origin_city), '') IS NULL)::INTEGER AS missing_origin_city,
  COUNT(*) FILTER (WHERE NULLIF(BTRIM(destination_city), '') IS NULL)::INTEGER AS missing_destination_city,
  COUNT(*) FILTER (WHERE NULLIF(BTRIM(destination_country), '') IS NULL)::INTEGER AS missing_destination_country,
  COUNT(*) FILTER (WHERE departure_date IS NULL)::INTEGER AS missing_departure_date,
  COUNT(*) FILTER (WHERE duration_days IS NULL)::INTEGER AS missing_duration,
  COUNT(*) FILTER (WHERE price_amount <= 0)::INTEGER AS non_positive_price,
  COUNT(*) FILTER (WHERE NULLIF(BTRIM(currency), '') IS NULL)::INTEGER AS missing_currency,
  COUNT(*) FILTER (
    WHERE COALESCE(CARDINALITY(includes), 0) = 0
  )::INTEGER AS offers_without_includes,
  COUNT(*) FILTER (
    WHERE COALESCE(CARDINALITY(excludes), 0) = 0
  )::INTEGER AS offers_without_excludes,
  COUNT(*) FILTER (WHERE expires_at IS NULL)::INTEGER AS missing_publication_expiry,
  COUNT(*) FILTER (
    WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
  )::INTEGER AS past_publication_expiry
FROM offers
GROUP BY trip_type
ORDER BY total_offers DESC, trip_type;

-- 2. Price-basis and currency mix. This is descriptive only; do not compare
-- nominal prices across currencies or treat this as a normalized price index.
SELECT
  trip_type,
  currency,
  price_type,
  COUNT(*)::INTEGER AS offer_count,
  COUNT(*) FILTER (WHERE status = 'published')::INTEGER AS published_count
FROM offers
GROUP BY trip_type, currency, price_type
ORDER BY trip_type, currency, price_type;

COMMIT;

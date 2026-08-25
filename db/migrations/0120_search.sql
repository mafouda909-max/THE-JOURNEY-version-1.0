-- ============================================================================
-- THE JOURNEY — Migration 0120: Search RPCs (AD-11 — verbatim scope)
-- search_places(q)  : cities + airports, pg_trgm, diacritic-normalized,
--                     prefix-weighted, LIMIT 8
-- search_airlines(q): carrier filter source (admin tooling / offers filter)
-- No other functionality is introduced here (ratified instruction).
-- ============================================================================

BEGIN;

-- ── search_places ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_places(q text)
RETURNS TABLE (
  id         uuid,
  slug       varchar,
  name_ar    text,
  name_en    text,
  country_ar text,
  kind       text,
  iata       char(3)
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH needle AS (
    SELECT public.normalize_arabic(btrim(q)) AS nq,
           lower(btrim(q))                   AS lq
  ),
  city_hits AS (
    SELECT c.id, c.slug, c.name_ar, c.name_en,
           co.name_ar AS country_ar,
           'city'     AS kind,
           NULL::char(3) AS iata,
           -- prefix-weighted ranking (AD-11): exact > prefix > trigram similarity
           (CASE
              WHEN c.name_ar_normalized = n.nq OR lower(c.name_en) = n.lq THEN 0
              WHEN c.name_ar_normalized LIKE n.nq || '%'
                OR lower(c.name_en) LIKE n.lq || '%' THEN 1
              ELSE 2
            END) AS bucket,
            GREATEST(
              similarity(c.name_ar_normalized, n.nq),
              similarity(lower(c.name_en), n.lq)
            ) AS sim
    FROM public.cities c
    JOIN public.countries co ON co.id = c.country_id
    CROSS JOIN needle n
    WHERE c.is_active
      AND ( c.name_ar_normalized LIKE '%' || n.nq || '%'
         OR lower(c.name_en)      LIKE '%' || n.lq || '%'
         OR c.name_ar_normalized %  n.nq
         OR lower(c.name_en)      %  n.lq )
  ),
  airport_hits AS (
    SELECT a.id, NULL::varchar AS slug, a.name_ar, a.name_en,
           ci.name_ar AS country_ar,   -- airport rows carry their CITY name here
           'airport'  AS kind,
           a.iata,
           (CASE
              WHEN a.name_ar_normalized = n.nq OR lower(a.name_en) = n.lq
                OR lower(a.iata) = n.lq THEN 0
              WHEN a.name_ar_normalized LIKE n.nq || '%'
                OR lower(a.name_en) LIKE n.lq || '%' THEN 1
              ELSE 2
            END) AS bucket,
            GREATEST(
              similarity(a.name_ar_normalized, n.nq),
              similarity(lower(a.name_en), n.lq)
            ) AS sim
    FROM public.airports a
    JOIN public.cities ci ON ci.id = a.city_id
    CROSS JOIN needle n
    WHERE a.is_active AND ci.is_active
      AND ( a.name_ar_normalized LIKE '%' || n.nq || '%'
         OR lower(a.name_en)      LIKE '%' || n.lq || '%'
         OR lower(a.iata)         LIKE n.lq || '%'
         OR a.name_ar_normalized %  n.nq
         OR lower(a.name_en)      %  n.lq )
  )
  SELECT h.id, h.slug, h.name_ar, h.name_en, h.country_ar, h.kind, h.iata
  FROM (
    SELECT * FROM city_hits
    UNION ALL
    SELECT * FROM airport_hits
  ) h
  ORDER BY h.bucket ASC, h.sim DESC NULLS LAST, h.name_ar ASC
  LIMIT 8;
$$;

COMMENT ON FUNCTION public.search_places(text) IS
  'Autocomplete over cities+airports (AD-11). Reads honor RLS/is_active. Slugs feed URL filters (§3.6).';

GRANT EXECUTE ON FUNCTION public.search_places(text) TO anon, authenticated;

-- airports need the same normalized generated column used above (§AD-11 note)
ALTER TABLE public.airports
  ADD COLUMN IF NOT EXISTS name_ar_normalized text
  GENERATED ALWAYS AS (public.normalize_arabic(name_ar)) STORED;

CREATE INDEX IF NOT EXISTS idx_airports_name_ar_norm_trgm
  ON public.airports USING gin (name_ar_normalized gin_trgm_ops);

-- ── search_airlines ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_airlines(q text)
RETURNS TABLE (
  id      uuid,
  name_ar text,
  name_en text,
  iata    char(2)
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH needle AS (
    SELECT public.normalize_arabic(btrim(q)) AS nq, lower(btrim(q)) AS lq
  )
  SELECT a.id, a.name_ar, a.name_en, a.iata
  FROM public.airlines a CROSS JOIN needle n
  WHERE a.is_active
    AND ( a.name_ar_normalized LIKE '%' || n.nq || '%'
       OR lower(a.name_en)     LIKE '%' || n.lq || '%'
       OR lower(a.iata)        LIKE n.lq || '%' )
  ORDER BY
    (CASE
       WHEN a.name_ar_normalized = n.nq OR lower(a.name_en) = n.lq
         OR lower(a.iata) = n.lq THEN 0
       WHEN a.name_ar_normalized LIKE n.nq || '%'
         OR lower(a.name_en) LIKE n.lq || '%' THEN 1
       ELSE 2
     END) ASC,
    a.name_ar ASC
  LIMIT 8;
$$;

COMMENT ON FUNCTION public.search_airlines(text) IS
  'Carrier autocomplete/filter source (AD-11). Active carriers only.';

GRANT EXECUTE ON FUNCTION public.search_airlines(text) TO anon, authenticated;

-- airlines normalized column for the same treatment
ALTER TABLE public.airlines
  ADD COLUMN IF NOT EXISTS name_ar_normalized text
  GENERATED ALWAYS AS (public.normalize_arabic(name_ar)) STORED;

COMMIT;

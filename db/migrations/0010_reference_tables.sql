-- ============================================================================
-- THE JOURNEY — Migration 0010: Reference Data Tables (C1 / AD-03 / AD-12)
-- countries → cities → airports strict single-parent chain (DB_DESIGN §2.3)
-- Airlines: internal UUID PK, nullable unique IATA/ICAO (§2.4)
-- Codes are NEVER invented; population via db/seeds/reference (AD-12)
-- ============================================================================

BEGIN;

-- ── countries ───────────────────────────────────────────────────────────────
CREATE TABLE public.countries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iso2        char(2)      NOT NULL UNIQUE,
  name_ar     text         NOT NULL,
  name_en     text         NOT NULL,
  is_active   boolean      NOT NULL DEFAULT true,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.countries IS
  'Reference geography root. ISO 3166 alpha-2 anchored. Public read; admin/service-role writes only (§3.5).';

-- ── cities ──────────────────────────────────────────────────────────────────
CREATE TABLE public.cities (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id          uuid        NOT NULL REFERENCES public.countries(id) ON DELETE RESTRICT,
  name_ar             text        NOT NULL,
  name_en             text        NOT NULL,
  name_ar_normalized  text GENERATED ALWAYS AS (public.normalize_arabic(name_ar)) STORED,
  slug                varchar(140) UNIQUE,
  latitude            numeric(9,6),
  longitude           numeric(9,6),
  is_popular          boolean     NOT NULL DEFAULT false,   -- drives homepage/fallback discovery (AD-11)
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_cities_country_name_en UNIQUE (country_id, name_en)
);

CREATE INDEX idx_cities_country        ON public.cities (country_id);
CREATE INDEX idx_cities_popular_active ON public.cities (is_popular) WHERE is_active;
CREATE INDEX idx_cities_name_ar_trgm   ON public.cities USING gin (name_ar gin_trgm_ops);
CREATE INDEX idx_cities_name_en_trgm   ON public.cities USING gin (name_en gin_trgm_ops);
CREATE INDEX idx_cities_name_ar_norm_trgm ON public.cities USING gin (name_ar_normalized gin_trgm_ops);

CREATE TRIGGER trg_cities_updated_at BEFORE UPDATE ON public.cities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── airports ────────────────────────────────────────────────────────────────
CREATE TABLE public.airports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id    uuid        NOT NULL REFERENCES public.cities(id) ON DELETE RESTRICT,
  name_ar    text        NOT NULL,
  name_en    text        NOT NULL,
  iata       char(3),
  icao       char(4),
  timezone   text,                                  -- IANA tz, optional (§3.7)
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- RATIFIED C1 integrity mechanism: enables the composite FK from offers so an
  -- airport refinement can never contradict its route city (AD-03).
  CONSTRAINT uq_airports_id_city UNIQUE (id, city_id)
);
-- Partial unique semantics per §3.7: codes optional (never invented placeholders).
CREATE UNIQUE INDEX uq_airports_iata_partial ON public.airports (iata) WHERE iata IS NOT NULL;
CREATE UNIQUE INDEX uq_airports_icao_partial ON public.airports (icao) WHERE icao IS NOT NULL;

CREATE INDEX idx_airports_city        ON public.airports (city_id);
CREATE INDEX idx_airports_name_ar_trgm ON public.airports USING gin (name_ar gin_trgm_ops);
CREATE INDEX idx_airports_name_en_trgm ON public.airports USING gin (name_en gin_trgm_ops);

CREATE TRIGGER trg_airports_updated_at BEFORE UPDATE ON public.airports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON CONSTRAINT uq_airports_id_city ON public.airports IS
  'Composite target for offers(origin|destination_airport_id, origin|destination_city_id) FKs — AD-03 ratified.';

-- ── airlines ────────────────────────────────────────────────────────────────
CREATE TABLE public.airlines (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar    text        NOT NULL,
  name_en    text        NOT NULL,
  iata       char(2),
  icao       char(3),
  logo_url   text,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_airlines_iata_partial ON public.airlines (iata) WHERE iata IS NOT NULL;
CREATE UNIQUE INDEX uq_airlines_icao_partial ON public.airlines (icao) WHERE icao IS NOT NULL;
CREATE INDEX idx_airlines_name_ar_trgm ON public.airlines USING gin (name_ar gin_trgm_ops);
CREATE INDEX idx_airlines_name_en_trgm ON public.airlines USING gin (name_en gin_trgm_ops);

CREATE TRIGGER trg_airlines_updated_at BEFORE UPDATE ON public.airlines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── badges (trust-mark catalog — every badge has criteria; never decorative §3.13) ──
CREATE TABLE public.badges (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             varchar(50) NOT NULL UNIQUE,
  name_ar          text        NOT NULL,
  name_en          text        NOT NULL,
  description_ar   text        NOT NULL,
  description_en   text        NOT NULL,
  criteria_text    text        NOT NULL,
  source           public.enum_badge_source NOT NULL DEFAULT 'manual',
  icon_key         varchar(60) NOT NULL,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMIT;

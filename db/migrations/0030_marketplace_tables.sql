-- ============================================================================
-- THE JOURNEY — Migration 0030: Marketplace Tables (DB_DESIGN §2.5–§2.8, §3.9–§3.11)
-- offers: cities canonical route + OPTIONAL airport/airline refinement
--         with composite-FK consistency (AD-03 ratified)
-- ============================================================================

BEGIN;

-- ── offers ──────────────────────────────────────────────────────────────────
CREATE TABLE public.offers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id              uuid        NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,

  -- Content (bilingual: *_ar required, *_en optional — AD-07)
  title_ar              varchar(200) NOT NULL CHECK (char_length(btrim(title_ar)) > 0),
  title_en              varchar(200),
  description_ar        text         NOT NULL CHECK (char_length(btrim(description_ar)) > 0),
  description_en        text,

  -- Classification
  trip_type             public.enum_trip_type NOT NULL,
  route_type            public.enum_route_type,          -- NULL = unspecified, always included in search

  -- Route: cities REQUIRED (canonical); airports/airline optional refinement
  origin_city_id        uuid        NOT NULL REFERENCES public.cities(id) ON DELETE RESTRICT,
  destination_city_id   uuid        NOT NULL REFERENCES public.cities(id) ON DELETE RESTRICT,
  origin_airport_id     uuid,
  destination_airport_id uuid,
  airline_id            uuid        REFERENCES public.airlines(id) ON DELETE RESTRICT,

  -- Travel dates (the trip itself — §2.7; nullable = open/flexible offer)
  departure_date        date,
  return_date           date,
  duration_days         integer     CHECK (duration_days >= 1),
  flexible_dates        boolean     NOT NULL DEFAULT false,

  -- Pricing (two orthogonal dimensions, zero ambiguity — §2.6)
  price_amount          numeric(12,2) NOT NULL CHECK (price_amount > 0),
  currency              char(3)       NOT NULL CHECK (currency IN ('SAR','EGP','AED','USD','EUR')),
  price_type            public.enum_price_type  NOT NULL,   -- fixed | starting_from
  price_basis           public.enum_price_basis NOT NULL,   -- per_person | per_group | total

  -- Inclusions
  includes              text[]      NOT NULL DEFAULT '{}',
  excludes              text[]      NOT NULL DEFAULT '{}',
  min_travelers         integer     NOT NULL DEFAULT 1 CHECK (min_travelers >= 1),
  max_travelers         integer,
  CONSTRAINT chk_offers_traveler_range CHECK (
    max_travelers IS NULL OR max_travelers >= min_travelers
  ),

  -- Lifecycle state (closed-world whitelist enforced by trigger in 0110 — B1/C4)
  status                public.enum_offer_status NOT NULL DEFAULT 'draft',
  valid_from            timestamptz NOT NULL,
  valid_until           timestamptz NOT NULL,
  CONSTRAINT chk_offers_valid_window CHECK (valid_until > valid_from),
  submitted_at          timestamptz,
  published_at          timestamptz,
  expired_at            timestamptz,
  rejection_reason      text,

  -- Engagement counters — derived read-models (§7): view_count via RPC only (Slice 1);
  -- clients NEVER write these columns directly.
  view_count            integer     NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  contact_count         integer     NOT NULL DEFAULT 0 CHECK (contact_count >= 0),

  is_demo               boolean     NOT NULL DEFAULT false,   -- AD-12
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- Route sanity + validity window
  CONSTRAINT chk_offers_route_cities_distinct CHECK (origin_city_id <> destination_city_id),

  -- ★ RATIFIED C1 integrity mechanism (AD-03):
  --   airport refinement can never contradict its route city.
  --   Works because airports carries UNIQUE(id, city_id).
  CONSTRAINT fk_offers_origin_airport_city
    FOREIGN KEY (origin_airport_id, origin_city_id)
    REFERENCES public.airports (id, city_id),
  CONSTRAINT fk_offers_destination_airport_city
    FOREIGN KEY (destination_airport_id, destination_city_id)
    REFERENCES public.airports (id, city_id)
);

COMMENT ON TABLE public.offers IS
  'Core commercial entity. Public consumption ONLY via public_offers projection view (§6). Direct status UPDATE denied to all client roles — transitions go through whitelisted functions (B1 closed world).';

-- Search & lifecycle indexes (AD-11 indexing strategy)
CREATE INDEX idx_offers_status_valid_until ON public.offers (status, valid_until);
CREATE INDEX idx_offers_dest_status_pub    ON public.offers (destination_city_id, status, published_at DESC);
CREATE INDEX idx_offers_origin_city        ON public.offers (origin_city_id);
CREATE INDEX idx_offers_airline            ON public.offers (airline_id) WHERE airline_id IS NOT NULL;
CREATE INDEX idx_offers_trip_type          ON public.offers (trip_type);
CREATE INDEX idx_offers_agent_status       ON public.offers (agent_id, status);
CREATE INDEX idx_offers_title_ar_trgm      ON public.offers USING gin (title_ar gin_trgm_ops);
CREATE INDEX idx_offers_is_demo            ON public.offers (is_demo);

CREATE TRIGGER trg_offers_updated_at BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── offer_media (ordered imagery — §3.10) ───────────────────────────────────
CREATE TABLE public.offer_media (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id      uuid        NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  storage_path  text        NOT NULL,
  alt_text      text,
  sort_order    smallint    NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_demo       boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_offer_media_sort UNIQUE (offer_id, sort_order)
);

CREATE INDEX idx_offer_media_offer ON public.offer_media (offer_id);

-- ── contact_requests (conversion bridge + review-eligibility anchor §3.11) ─
CREATE TABLE public.contact_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id           uuid        NOT NULL REFERENCES public.offers(id) ON DELETE RESTRICT,
  traveler_id        uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id           uuid        NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  -- ^ DENORMALIZED = offer.agent_id, force-maintained by trigger (§3 key mechanism 3)

  message            text        NOT NULL CHECK (char_length(btrim(message)) > 0),  -- min-length policy app-side per SPEC
  traveler_count     integer     NOT NULL DEFAULT 1 CHECK (traveler_count >= 1),
  travel_dates_note  text,       -- free-form flexible input per SPEC §3.4

  status             public.enum_contact_status NOT NULL DEFAULT 'new',
  response_message   text,
  viewed_at          timestamptz,
  responded_at       timestamptz,
  closed_at          timestamptz,

  is_demo            boolean     NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- One LIVE request per traveler×offer (anti-spam without blocking re-contact later)
CREATE UNIQUE INDEX uq_contact_one_live_per_pair
  ON public.contact_requests (traveler_id, offer_id)
  WHERE status IN ('new', 'viewed');

CREATE INDEX idx_contact_agent_inbox ON public.contact_requests (agent_id, status, created_at DESC);
CREATE INDEX idx_contact_traveler    ON public.contact_requests (traveler_id, created_at DESC);
CREATE INDEX idx_contact_offer       ON public.contact_requests (offer_id);

CREATE TRIGGER trg_contact_updated_at BEFORE UPDATE ON public.contact_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;

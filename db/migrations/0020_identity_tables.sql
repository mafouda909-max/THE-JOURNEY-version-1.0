-- ============================================================================
-- THE JOURNEY — Migration 0020: Identity Tables (DB_DESIGN §2.1, §2.2, §3.1–§3.4)
-- users + agent_profiles (NO separate traveler profiles — §2.1 ratified)
-- Verification split into requests (attempts) + documents (sensitive artifacts)
-- ============================================================================

BEGIN;

-- ── users ───────────────────────────────────────────────────────────────────
CREATE TABLE public.users (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          public.enum_user_role NOT NULL DEFAULT 'traveler',
  display_name  varchar(80)  NOT NULL CHECK (char_length(btrim(display_name)) >= 2),
  phone         varchar(20),
  language_pref public.enum_locale    NOT NULL DEFAULT 'ar',
  is_active     boolean      NOT NULL DEFAULT true,
  is_demo       boolean      NOT NULL DEFAULT false,   -- AD-12 demo purge support
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.users IS
  'App-level identity. NO public read — public surfaces use projection views (§3.1 security).';

CREATE INDEX idx_users_role_active ON public.users (role) WHERE is_active;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Admin check for RLS policies / definer functions (AD-05).
-- Reads the authoritative role from public.users; JWT-claim optimization is a
-- provisioning step and must never weaken this check.
-- (Relocated here from 0001: LANGUAGE sql bodies are validated at creation
--  time, so this must be created only after public.users exists.)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
      AND u.is_active
  );
$$;

-- ── agent_profiles ──────────────────────────────────────────────────────────
CREATE TABLE public.agent_profiles (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  display_name           varchar(120) NOT NULL CHECK (char_length(btrim(display_name)) >= 2),
  business_name          varchar(160),
  bio_ar                 text,
  bio_en                 text,
  photo_url              text,
  city_id                uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  license_type           public.enum_license_type NOT NULL DEFAULT 'individual',
  license_number         varchar(80),
  specialty_tags         text[]      NOT NULL DEFAULT '{}',
  languages_spoken       text[]      NOT NULL DEFAULT '{ar}',
  profile_slug           varchar(140) UNIQUE,
  verification_status    public.enum_agent_verification NOT NULL DEFAULT 'unverified',
  verified_at            timestamptz,
  joined_at              timestamptz NOT NULL DEFAULT now(),

  -- Derived read-models — trigger/job maintained ONLY (§3.2, §7). Never written by app code.
  avg_rating             numeric(3,2) NOT NULL DEFAULT 0 CHECK (avg_rating BETWEEN 0 AND 5),
  reviews_count          integer      NOT NULL DEFAULT 0 CHECK (reviews_count >= 0),
  published_offers_count integer      NOT NULL DEFAULT 0 CHECK (published_offers_count >= 0),
  response_rate_pct      smallint     NOT NULL DEFAULT 0 CHECK (response_rate_pct BETWEEN 0 AND 100),
  avg_response_hours     numeric(5,1) NOT NULL DEFAULT 0,

  is_demo                boolean      NOT NULL DEFAULT false,   -- AD-12
  created_at             timestamptz  NOT NULL DEFAULT now(),
  updated_at             timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT chk_agent_bio_ar_required CHECK (
    verification_status <> 'verified' OR (bio_ar IS NOT NULL AND char_length(btrim(bio_ar)) > 0)
  )
);

CREATE INDEX idx_agent_verification_status ON public.agent_profiles (verification_status);
CREATE INDEX idx_agent_city                ON public.agent_profiles (city_id);
CREATE INDEX idx_agent_display_name_trgm   ON public.agent_profiles USING gin (display_name gin_trgm_ops);
CREATE INDEX idx_agent_is_demo             ON public.agent_profiles (is_demo);

CREATE TRIGGER trg_agent_updated_at BEFORE UPDATE ON public.agent_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Agent-profile lookup helper for policies/functions (AD-05).
-- (Relocated below the agent_profiles table definition: LANGUAGE sql bodies
--  are validated at creation time and must not forward-reference.)
CREATE OR REPLACE FUNCTION public.current_agent_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.agent_profiles p
  JOIN public.users u ON u.id = p.user_id
  WHERE p.user_id = auth.uid()
    AND u.is_active;
$$;

-- ── verification_requests (one auditable attempt per submission — §3.3) ────
CREATE TABLE public.verification_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        uuid        NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  status          public.enum_verification_status NOT NULL DEFAULT 'in_review',
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  reviewed_by     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  decision_note   text,   -- REQUIRED when rejected — asserted in review function (0110)
  is_demo         boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Max ONE in-review attempt per agent at a time (§3.3 rules)
CREATE UNIQUE INDEX uq_verification_one_in_review
  ON public.verification_requests (agent_id) WHERE status = 'in_review';
CREATE INDEX idx_verification_agent_submitted
  ON public.verification_requests (agent_id, submitted_at DESC);

CREATE TRIGGER trg_verification_req_updated_at BEFORE UPDATE ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── verification_documents (PRIVATE bucket pointers — §3.4 / AD-06) ────────
CREATE TABLE public.verification_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid        NOT NULL REFERENCES public.verification_requests(id) ON DELETE CASCADE,
  doc_type      public.enum_doc_type NOT NULL,
  storage_path  text        NOT NULL,
  mime_type     text        NOT NULL,
  size_bytes    integer     NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760), -- ≤10MB
  status        public.enum_doc_status NOT NULL DEFAULT 'pending',
  review_note   text,
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  reviewed_at   timestamptz,
  is_demo       boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- STRICTEST table: owner/admin access via server-issued signed URLs only (AD-06).
CREATE INDEX idx_verification_docs_request ON public.verification_documents (request_id);

CREATE TRIGGER trg_verification_docs_updated_at BEFORE UPDATE ON public.verification_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;

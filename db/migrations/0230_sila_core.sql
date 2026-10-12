-- ============================================================================
-- THE JOURNEY / SILA — Migration 0230: Sila Core Pillars
-- 1. Travel Community (posts, post_comments, post_likes)
-- 2. Official Visa Guides (visa_guides, public_visa_guides)
-- 3. Direct RFQ Marketplace (rfq_inquiries, rfq_quotes)
-- All tables protected by strict Row Level Security (RLS)
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. مجتمع السفر (Travel Community Feed: posts, post_comments, post_likes)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.posts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title                 varchar(250) NOT NULL CHECK (char_length(btrim(title)) > 0),
  content               text NOT NULL CHECK (char_length(btrim(content)) > 0),
  country_id            uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  city_id               uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  trip_type             public.enum_trip_type,
  tags                  text[] NOT NULL DEFAULT '{}',
  media_urls            text[] NOT NULL DEFAULT '{}',
  likes_count           integer NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  comments_count        integer NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  is_pinned             boolean NOT NULL DEFAULT false,
  status                varchar(20) NOT NULL DEFAULT 'published' 
                        CHECK (status IN ('draft', 'published', 'archived', 'hidden')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_feed ON public.posts (status, created_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts (user_id);
CREATE INDEX IF NOT EXISTS idx_posts_country_id ON public.posts (country_id) WHERE country_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_city_id ON public.posts (city_id) WHERE city_id IS NOT NULL;

CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.post_comments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id               uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content               text NOT NULL CHECK (char_length(btrim(content)) > 0),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments (post_id, created_at ASC);

CREATE TRIGGER trg_post_comments_updated_at
  BEFORE UPDATE ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id               uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- Triggers for comment and like counts
CREATE OR REPLACE FUNCTION public.sync_post_comments_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_comments_count ON public.post_comments;
CREATE TRIGGER trg_sync_comments_count
  AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_comments_count();

CREATE OR REPLACE FUNCTION public.sync_post_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_likes_count ON public.post_likes;
CREATE TRIGGER trg_sync_likes_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_likes_count();

-- RLS: posts, post_comments, post_likes
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.posts FROM anon, authenticated;
REVOKE ALL ON public.post_comments FROM anon, authenticated;
REVOKE ALL ON public.post_likes FROM anon, authenticated;

GRANT SELECT ON public.posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.posts TO authenticated;

DROP POLICY IF EXISTS posts_public_read ON public.posts;
CREATE POLICY posts_public_read ON public.posts FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS posts_owner_insert ON public.posts;
CREATE POLICY posts_owner_insert ON public.posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS posts_owner_update ON public.posts;
CREATE POLICY posts_owner_update ON public.posts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS posts_owner_delete ON public.posts;
CREATE POLICY posts_owner_delete ON public.posts FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS posts_admin_all ON public.posts;
CREATE POLICY posts_admin_all ON public.posts FOR ALL TO authenticated USING (public.is_admin());

GRANT SELECT ON public.post_comments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;

DROP POLICY IF EXISTS comments_public_read ON public.post_comments;
CREATE POLICY comments_public_read ON public.post_comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id AND p.status = 'published')
);

DROP POLICY IF EXISTS comments_owner_insert ON public.post_comments;
CREATE POLICY comments_owner_insert ON public.post_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS comments_owner_update ON public.post_comments;
CREATE POLICY comments_owner_update ON public.post_comments FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS comments_owner_delete ON public.post_comments;
CREATE POLICY comments_owner_delete ON public.post_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

GRANT SELECT ON public.post_likes TO anon, authenticated;
GRANT INSERT, DELETE ON public.post_likes TO authenticated;

DROP POLICY IF EXISTS likes_public_read ON public.post_likes;
CREATE POLICY likes_public_read ON public.post_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS likes_owner_insert ON public.post_likes;
CREATE POLICY likes_owner_insert ON public.post_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS likes_owner_delete ON public.post_likes;
CREATE POLICY likes_owner_delete ON public.post_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Projection View: public_posts
CREATE OR REPLACE VIEW public.public_posts AS
SELECT
  p.id,
  p.title,
  p.content,
  p.user_id,
  u.display_name AS author_name,
  u.role AS author_role,
  ap.business_name AS agent_business_name,
  ap.is_verified AS is_agent_verified,
  p.country_id,
  c.name_ar AS country_name_ar,
  c.name_en AS country_name_en,
  p.city_id,
  ci.name_ar AS city_name_ar,
  ci.name_en AS city_name_en,
  p.trip_type,
  p.tags,
  p.media_urls,
  p.likes_count,
  p.comments_count,
  p.is_pinned,
  p.created_at,
  p.updated_at
FROM public.posts p
JOIN public.users u ON u.id = p.user_id
LEFT JOIN public.agent_profiles ap ON ap.user_id = u.id
LEFT JOIN public.countries c ON c.id = p.country_id
LEFT JOIN public.cities ci ON ci.id = p.city_id
WHERE p.status = 'published';

GRANT SELECT ON public.public_posts TO anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 2. التأشيرات والاكتشاف (Visa Guides & Official Verification: visa_guides)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.visa_guides (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  origin_country_id     uuid REFERENCES public.countries(id) ON DELETE CASCADE,
  visa_type             varchar(50) NOT NULL CHECK (visa_type IN ('visa_free', 'e_visa', 'on_arrival', 'embassy_visa', 'eta')),
  title_ar              varchar(250) NOT NULL CHECK (char_length(btrim(title_ar)) > 0),
  title_en              varchar(250),
  summary_ar            text NOT NULL CHECK (char_length(btrim(summary_ar)) > 0),
  summary_en            text,
  requirements_ar       text[] NOT NULL DEFAULT '{}',
  documents_required    text[] NOT NULL DEFAULT '{}',
  processing_time_days  integer CHECK (processing_time_days IS NULL OR processing_time_days >= 0),
  validity_days         integer CHECK (validity_days IS NULL OR validity_days >= 1),
  stay_duration_days    integer CHECK (stay_duration_days IS NULL OR stay_duration_days >= 1),
  cost_estimate         numeric(10,2) CHECK (cost_estimate IS NULL OR cost_estimate >= 0),
  currency              char(3) NOT NULL DEFAULT 'SAR' CHECK (currency IN ('SAR','EGP','AED','USD','EUR')),
  official_portal_url   text,
  official_source_name  varchar(250),
  is_official_verified  boolean NOT NULL DEFAULT true,
  last_verified_at      timestamptz DEFAULT now(),
  notes_ar              text,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visa_guides_dest ON public.visa_guides (destination_country_id, origin_country_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_visa_guides_type ON public.visa_guides (visa_type);
CREATE INDEX IF NOT EXISTS idx_visa_guides_official ON public.visa_guides (is_official_verified);

CREATE TRIGGER trg_visa_guides_updated_at
  BEFORE UPDATE ON public.visa_guides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: visa_guides
ALTER TABLE public.visa_guides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.visa_guides FROM anon, authenticated;

GRANT SELECT ON public.visa_guides TO anon, authenticated;

DROP POLICY IF EXISTS visa_guides_public_read ON public.visa_guides;
CREATE POLICY visa_guides_public_read ON public.visa_guides FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS visa_guides_admin_write ON public.visa_guides;
CREATE POLICY visa_guides_admin_write ON public.visa_guides FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Projection View: public_visa_guides
CREATE OR REPLACE VIEW public.public_visa_guides AS
SELECT
  vg.id,
  vg.destination_country_id,
  cd.name_ar AS destination_country_name_ar,
  cd.name_en AS destination_country_name_en,
  cd.iso2 AS destination_country_iso2,
  vg.origin_country_id,
  co.name_ar AS origin_country_name_ar,
  co.name_en AS origin_country_name_en,
  co.iso2 AS origin_country_iso2,
  vg.visa_type,
  vg.title_ar,
  vg.title_en,
  vg.summary_ar,
  vg.summary_en,
  vg.requirements_ar,
  vg.documents_required,
  vg.processing_time_days,
  vg.validity_days,
  vg.stay_duration_days,
  vg.cost_estimate,
  vg.currency,
  vg.official_portal_url,
  vg.official_source_name,
  vg.is_official_verified,
  vg.last_verified_at,
  vg.notes_ar,
  vg.created_at,
  vg.updated_at
FROM public.visa_guides vg
JOIN public.countries cd ON cd.id = vg.destination_country_id
LEFT JOIN public.countries co ON co.id = vg.origin_country_id
WHERE vg.is_active = true;

GRANT SELECT ON public.public_visa_guides TO anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 3. سوق العروض المباشرة (Direct RFQ Marketplace: rfq_inquiries, rfq_quotes)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rfq_inquiries (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES public.users(id) ON DELETE SET NULL,
  contact_name          varchar(150) NOT NULL CHECK (char_length(btrim(contact_name)) > 0),
  contact_phone         varchar(50) NOT NULL CHECK (char_length(btrim(contact_phone)) > 0),
  contact_email         varchar(255),
  origin_city_id        uuid REFERENCES public.cities(id) ON DELETE RESTRICT,
  destination_city_id   uuid REFERENCES public.cities(id) ON DELETE RESTRICT,
  trip_type             public.enum_trip_type NOT NULL,
  departure_date        date,
  return_date           date,
  flexible_dates        boolean NOT NULL DEFAULT false,
  travelers_count       integer NOT NULL DEFAULT 1 CHECK (travelers_count >= 1),
  budget_amount         numeric(12,2) CHECK (budget_amount IS NULL OR budget_amount > 0),
  budget_currency       char(3) NOT NULL DEFAULT 'SAR' CHECK (budget_currency IN ('SAR','EGP','AED','USD','EUR')),
  description           text NOT NULL CHECK (char_length(btrim(description)) > 0),
  target_agent_id       uuid REFERENCES public.agent_profiles(id) ON DELETE SET NULL,
  status                varchar(30) NOT NULL DEFAULT 'open' 
                        CHECK (status IN ('open', 'quotes_received', 'accepted', 'closed', 'cancelled')),
  quotes_count          integer NOT NULL DEFAULT 0 CHECK (quotes_count >= 0),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rfq_status ON public.rfq_inquiries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rfq_user_id ON public.rfq_inquiries (user_id);
CREATE INDEX IF NOT EXISTS idx_rfq_target_agent ON public.rfq_inquiries (target_agent_id);
CREATE INDEX IF NOT EXISTS idx_rfq_dest_city ON public.rfq_inquiries (destination_city_id);

CREATE TRIGGER trg_rfq_inquiries_updated_at
  BEFORE UPDATE ON public.rfq_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.rfq_quotes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id            uuid NOT NULL REFERENCES public.rfq_inquiries(id) ON DELETE CASCADE,
  agent_id              uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  quote_amount          numeric(12,2) NOT NULL CHECK (quote_amount > 0),
  currency              char(3) NOT NULL DEFAULT 'SAR' CHECK (currency IN ('SAR','EGP','AED','USD','EUR')),
  proposal_details      text NOT NULL CHECK (char_length(btrim(proposal_details)) > 0),
  valid_until           timestamptz,
  status                varchar(30) NOT NULL DEFAULT 'submitted' 
                        CHECK (status IN ('submitted', 'accepted', 'declined', 'expired')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_rfq_quote_agent UNIQUE (inquiry_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_rfq_quotes_inquiry ON public.rfq_quotes (inquiry_id);
CREATE INDEX IF NOT EXISTS idx_rfq_quotes_agent ON public.rfq_quotes (agent_id);

CREATE TRIGGER trg_rfq_quotes_updated_at
  BEFORE UPDATE ON public.rfq_quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.sync_rfq_quotes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.rfq_inquiries
    SET quotes_count = quotes_count + 1,
        status = CASE WHEN status = 'open' THEN 'quotes_received' ELSE status END
    WHERE id = NEW.inquiry_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.rfq_inquiries
    SET quotes_count = GREATEST(0, quotes_count - 1)
    WHERE id = OLD.inquiry_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_rfq_quotes_count ON public.rfq_quotes;
CREATE TRIGGER trg_sync_rfq_quotes_count
  AFTER INSERT OR DELETE ON public.rfq_quotes
  FOR EACH ROW EXECUTE FUNCTION public.sync_rfq_quotes_count();

-- RLS: rfq_inquiries, rfq_quotes
ALTER TABLE public.rfq_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_quotes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.rfq_inquiries FROM anon, authenticated;
REVOKE ALL ON public.rfq_quotes FROM anon, authenticated;

GRANT SELECT, INSERT ON public.rfq_inquiries TO anon, authenticated;
GRANT UPDATE ON public.rfq_inquiries TO authenticated;

DROP POLICY IF EXISTS rfq_traveler_select ON public.rfq_inquiries;
CREATE POLICY rfq_traveler_select ON public.rfq_inquiries FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS rfq_agent_select ON public.rfq_inquiries;
CREATE POLICY rfq_agent_select ON public.rfq_inquiries FOR SELECT TO authenticated
  USING (
    public.current_agent_profile_id() IS NOT NULL AND (
      target_agent_id IS NULL OR target_agent_id = public.current_agent_profile_id()
    )
  );

DROP POLICY IF EXISTS rfq_admin_select ON public.rfq_inquiries;
CREATE POLICY rfq_admin_select ON public.rfq_inquiries FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS rfq_insert ON public.rfq_inquiries;
CREATE POLICY rfq_insert ON public.rfq_inquiries FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS rfq_traveler_update ON public.rfq_inquiries;
CREATE POLICY rfq_traveler_update ON public.rfq_inquiries FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.rfq_quotes TO authenticated;

DROP POLICY IF EXISTS rfq_quotes_agent_select ON public.rfq_quotes;
CREATE POLICY rfq_quotes_agent_select ON public.rfq_quotes FOR SELECT TO authenticated
  USING (agent_id = public.current_agent_profile_id());

DROP POLICY IF EXISTS rfq_quotes_traveler_select ON public.rfq_quotes;
CREATE POLICY rfq_quotes_traveler_select ON public.rfq_quotes FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.rfq_inquiries i WHERE i.id = rfq_quotes.inquiry_id AND i.user_id = auth.uid())
  );

DROP POLICY IF EXISTS rfq_quotes_agent_insert ON public.rfq_quotes;
CREATE POLICY rfq_quotes_agent_insert ON public.rfq_quotes FOR INSERT TO authenticated
  WITH CHECK (agent_id = public.current_agent_profile_id());

DROP POLICY IF EXISTS rfq_quotes_admin_all ON public.rfq_quotes;
CREATE POLICY rfq_quotes_admin_all ON public.rfq_quotes FOR ALL TO authenticated
  USING (public.is_admin());

-- Projection View: public_rfq_inquiries
CREATE OR REPLACE VIEW public.public_rfq_inquiries AS
SELECT
  i.id,
  i.contact_name,
  i.origin_city_id,
  co.name_ar AS origin_city_name_ar,
  co.name_en AS origin_city_name_en,
  i.destination_city_id,
  cd.name_ar AS destination_city_name_ar,
  cd.name_en AS destination_city_name_en,
  i.trip_type,
  i.departure_date,
  i.return_date,
  i.flexible_dates,
  i.travelers_count,
  i.budget_amount,
  i.budget_currency,
  i.description,
  i.target_agent_id,
  ap.business_name AS target_agent_name,
  i.status,
  i.quotes_count,
  i.created_at
FROM public.rfq_inquiries i
LEFT JOIN public.cities co ON co.id = i.origin_city_id
LEFT JOIN public.cities cd ON cd.id = i.destination_city_id
LEFT JOIN public.agent_profiles ap ON ap.id = i.target_agent_id;

GRANT SELECT ON public.public_rfq_inquiries TO authenticated;

COMMIT;

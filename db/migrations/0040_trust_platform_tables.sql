-- ============================================================================
-- THE JOURNEY — Migration 0040: Trust & Platform Tables
-- (DB_DESIGN §2.9, §3.12–§3.18)
-- ============================================================================

BEGIN;

-- ── reviews (trust signal anchored to real interactions — C3 + B2 window) ──
CREATE TABLE public.reviews (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_request_id      uuid        NOT NULL UNIQUE REFERENCES public.contact_requests(id) ON DELETE CASCADE,
  author_id               uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id                uuid        NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  -- ^ author/agent denormalized from the request; consistency asserted by trigger (§2.9)

  rating                  smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content                 text        NOT NULL CHECK (char_length(btrim(content)) > 0),
  is_verified_transaction boolean     NOT NULL DEFAULT false,   -- admin-confirmed completion (future)
  is_visible              boolean     NOT NULL DEFAULT true,
  moderated_by            uuid        REFERENCES public.users(id) ON DELETE SET NULL,

  is_demo                 boolean     NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Authors are INSERT-only via the eligibility function; rating/content immutable.
CREATE INDEX idx_reviews_agent_visible ON public.reviews (agent_id) WHERE is_visible;

CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── badges award ledger (manual badges only — §3.14) ───────────────────────
CREATE TABLE public.agent_badges (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       uuid        NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  badge_id       uuid        NOT NULL REFERENCES public.badges(id) ON DELETE RESTRICT,
  awarded_by     uuid        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  awarded_at     timestamptz NOT NULL DEFAULT now(),
  revoked_at     timestamptz,
  revoke_reason  text,
  is_demo        boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_agent_badge_active
  ON public.agent_badges (agent_id, badge_id) WHERE revoked_at IS NULL;

-- ── notifications (event-driven in-app inbox — AD-10, §3.15) ───────────────
CREATE TABLE public.notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type         varchar(80) NOT NULL,   -- registry: offer.approved | offer.rejected | offer.expiring_7d |
                                       -- offer.expiring_1d | offer.expired | contact.received |
                                       -- contact.responded | review.new | verification.approved |
                                       -- verification.rejected | saved_offer.expiring
  payload      jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- ids + snapshot strings (survive target edits)
  is_demo      boolean     NOT NULL DEFAULT false,        -- AD-12
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient_created ON public.notifications (recipient_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications (recipient_id) WHERE read_at IS NULL;

-- ── saved_offers (traveler favorites — §3.16) ──────────────────────────────
CREATE TABLE public.saved_offers (
  traveler_id uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  offer_id    uuid        NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  is_demo     boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (traveler_id, offer_id)
);

-- ── reports (abuse signaling — schema in V1, admin queue UI deferred §3.17) ─
CREATE TABLE public.reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_type     public.enum_report_target  NOT NULL,
  target_id       uuid                       NOT NULL,
  reason          public.enum_report_reason  NOT NULL,
  details         text,
  status          public.enum_report_status  NOT NULL DEFAULT 'open',
  handled_by      uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  handled_at      timestamptz,
  resolution_note text,
  is_demo         boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_report_open_per_reporter
  ON public.reports (reporter_id, target_type, target_id) WHERE status = 'open';
CREATE INDEX idx_reports_status_created ON public.reports (status, created_at);

CREATE TRIGGER trg_reports_updated_at BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── admin_actions (append-only audit ledger — §3.18 / AD-05) ───────────────
CREATE TABLE public.admin_actions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     uuid        NOT NULL REFERENCES public.users(id),  -- RESTRICT: ledger outlives accounts
  action_type  varchar(80) NOT NULL,   -- registry: OFFER_APPROVE | OFFER_REJECT | VERIFICATION_APPROVE |
                                       -- VERIFICATION_REJECT | AGENT_SUSPEND | AGENT_REINSTATE |
                                       -- BADGE_AWARD | BADGE_REVOKE | REFERENCE_UPSERT | REVIEW_MODERATE
  target_type  varchar(40) NOT NULL,
  target_id    uuid        NOT NULL,
  metadata     jsonb,
  -- E2 major-edit snapshots use the PINNED contract {before, after, changed_fields[]} (Q2 ratified)
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_actions_target ON public.admin_actions (target_type, target_id);
CREATE INDEX idx_admin_actions_actor  ON public.admin_actions (actor_id, created_at DESC);

COMMENT ON TABLE public.admin_actions IS
  'APPEND-ONLY: no UPDATE/DELETE grants or policies exist at any level (§6).';

COMMIT;

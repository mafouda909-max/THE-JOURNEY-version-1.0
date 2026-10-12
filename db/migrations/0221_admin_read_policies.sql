-- ============================================================================
-- THE JOURNEY — Migration 0221: Admin portal read policies (Slice 2)
--
-- Implements DATABASE_DESIGN §5 permission matrix rows for the ADMIN role
-- inside the ratified Slice 2 scope (Decision 1): queues and detail screens
-- must read cross-agent data through the ADMIN USER session (never
-- service-role in request paths). Every policy is gated by the existing
-- SECURITY DEFINER public.is_admin() (AD-05) — role comes from
-- public.users, never client claims. Purely ADDITIVE SELECT grants;
-- write paths remain exclusively the audited definer RPCs (B1 preserved).
-- ============================================================================

BEGIN;

-- Offers: full preview for review queue/detail (E2 snapshot display):
DROP POLICY IF EXISTS admin_read_offers ON public.offers;
CREATE POLICY admin_read_offers ON public.offers FOR SELECT TO authenticated
  USING (public.is_admin());

-- Offer media metadata (paths listed in review detail):
DROP POLICY IF EXISTS admin_read_offer_media ON public.offer_media;
CREATE POLICY admin_read_offer_media ON public.offer_media FOR SELECT TO authenticated
  USING (public.is_admin());

-- Verification requests: queue + history:
DROP POLICY IF EXISTS admin_read_verification_requests ON public.verification_requests;
CREATE POLICY admin_read_verification_requests ON public.verification_requests FOR SELECT TO authenticated
  USING (public.is_admin());

-- Verification documents METADATA (object bytes remain private-bucket only,
-- accessed exclusively via service-side signed URLs per AD-06):
DROP POLICY IF EXISTS admin_read_verification_documents ON public.verification_documents;
CREATE POLICY admin_read_verification_documents ON public.verification_documents FOR SELECT TO authenticated
  USING (public.is_admin());

-- Agent profiles: management list/detail across ALL statuses:
DROP POLICY IF EXISTS admin_read_agent_profiles ON public.agent_profiles;
CREATE POLICY admin_read_agent_profiles ON public.agent_profiles FOR SELECT TO authenticated
  USING (public.is_admin());

-- Users: identity/email display in management screens:
DROP POLICY IF EXISTS admin_read_users ON public.users;
CREATE POLICY admin_read_users ON public.users FOR SELECT TO authenticated
  USING (public.is_admin());

COMMIT;
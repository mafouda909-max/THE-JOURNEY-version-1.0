-- ============================================================================
-- THE JOURNEY / الرحلة — Migration 0001: Extensions, Enums, Helpers
-- Canonical source: docs/DATABASE_DESIGN.md §1 (conventions), §3 (entity catalog)
-- Ratified rules encoded:
--   B3  : ENUM labels are lowercase snake_case — NEVER uppercase in PostgreSQL
--   C4  : lifecycle vocabulary (see offers transition whitelist in 0110)
-- ============================================================================

BEGIN;

-- ── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- search autocomplete (AD-11)
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- explicit digest support where needed

-- gen_random_uuid() is core since PG13; no extension required.

-- ── Enums (labels lowercase snake_case — B3) ───────────────────────────────
CREATE TYPE public.enum_user_role            AS ENUM ('traveler', 'agent', 'admin');
CREATE TYPE public.enum_locale               AS ENUM ('ar', 'en');

CREATE TYPE public.enum_agent_verification   AS ENUM ('unverified', 'in_review', 'verified', 'rejected', 'suspended');
CREATE TYPE public.enum_verification_status  AS ENUM ('in_review', 'approved', 'rejected', 'withdrawn');
CREATE TYPE public.enum_doc_type             AS ENUM ('national_id', 'tourism_license', 'commercial_registration', 'other');
CREATE TYPE public.enum_doc_status           AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE public.enum_license_type         AS ENUM ('individual', 'agency');

CREATE TYPE public.enum_trip_type            AS ENUM ('flight', 'package', 'visa', 'umrah', 'hotel', 'cruise', 'custom');
CREATE TYPE public.enum_route_type           AS ENUM ('direct', 'transit');
CREATE TYPE public.enum_price_type           AS ENUM ('fixed', 'starting_from');
CREATE TYPE public.enum_price_basis          AS ENUM ('per_person', 'per_group', 'total');
CREATE TYPE public.enum_offer_status         AS ENUM ('draft', 'pending_review', 'published', 'rejected', 'expired', 'archived');

CREATE TYPE public.enum_contact_status       AS ENUM ('new', 'viewed', 'responded', 'closed', 'cancelled');

CREATE TYPE public.enum_badge_source         AS ENUM ('manual', 'derived');
CREATE TYPE public.enum_report_target        AS ENUM ('offer', 'agent_profile', 'review', 'contact_request');
CREATE TYPE public.enum_report_reason        AS ENUM ('misleading_price', 'fake_offer', 'impersonation', 'inappropriate_contact_info', 'other');
CREATE TYPE public.enum_report_status        AS ENUM ('open', 'in_review', 'resolved', 'dismissed');

-- ── Shared helpers ──────────────────────────────────────────────────────────

-- updated_at toucher (DATABASE_DESIGN.md §1 convention 2)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Arabic search normalization: strips harakat (U+064B–U+0652), tatweel (U+0640).
-- IMMUTABLE so it can back a generated column (cities.name_ar_normalized).
CREATE OR REPLACE FUNCTION public.normalize_arabic(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    translate(
      txt,
      U&'\064B\064C\064D\064E\064F\0650\0651\0652\0640',
      ''
    )
  );
$$;

-- NOTE: public.is_admin() is defined in 0020_identity_tables.sql, AFTER
-- public.users exists — its LANGUAGE sql body is validated at creation time,
-- so a forward reference would abort this migration (SQLSTATE 42P01).

COMMIT;

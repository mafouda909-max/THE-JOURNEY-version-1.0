-- Migration 0230: SILA Core Pillars (Visa Guides & RFQ Inquiries)
-- Additive, safe migration compatible with PostgreSQL and Supabase.

CREATE TABLE IF NOT EXISTS visa_guides (
    id SERIAL PRIMARY KEY,
    nationality_country VARCHAR(80) NOT NULL,
    destination_country VARCHAR(80) NOT NULL,
    destination_country_en VARCHAR(80) NOT NULL,
    visa_type VARCHAR(32) NOT NULL,
    entry_requirements TEXT[] NOT NULL DEFAULT '{}',
    stay_duration_days INTEGER,
    official_portal_url TEXT NOT NULL,
    official_source_name TEXT NOT NULL,
    last_verified_at TIMESTAMP NOT NULL DEFAULT NOW(),
    notes TEXT,
    airport_procedures TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS visa_guides_lookup_idx ON visa_guides (nationality_country, destination_country);
CREATE INDEX IF NOT EXISTS visa_guides_destination_idx ON visa_guides (destination_country_en);

CREATE TABLE IF NOT EXISTS rfq_inquiries (
    id SERIAL PRIMARY KEY,
    traveler_name TEXT NOT NULL,
    traveler_email TEXT NOT NULL,
    traveler_phone TEXT,
    origin_city TEXT NOT NULL,
    destination_country TEXT NOT NULL,
    destination_city TEXT,
    travel_dates TEXT,
    traveler_count INTEGER NOT NULL DEFAULT 1,
    trip_type VARCHAR(24) NOT NULL DEFAULT 'package',
    budget_preference VARCHAR(32),
    notes TEXT,
    status VARCHAR(24) NOT NULL DEFAULT 'new',
    traveler_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS rfq_inquiries_destination_idx ON rfq_inquiries (destination_country);
CREATE INDEX IF NOT EXISTS rfq_inquiries_email_idx ON rfq_inquiries (traveler_email);
CREATE INDEX IF NOT EXISTS rfq_inquiries_status_idx ON rfq_inquiries (status);

-- Enable Row Level Security (RLS)
ALTER TABLE visa_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_inquiries ENABLE ROW LEVEL SECURITY;

-- 1. Public read for verified visa guides
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'visa_guides' AND policyname = 'visa_guides_public_read'
    ) THEN
        CREATE POLICY visa_guides_public_read ON visa_guides FOR SELECT USING (is_verified = TRUE);
    END IF;
END $$;

-- 2. Least-privilege insert for travelers submitting RFQ inquiries
-- Restricted strictly to status = 'new' to prevent unauthorized status elevation.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'rfq_inquiries' AND policyname = 'rfq_inquiries_public_insert'
    ) THEN
        DROP POLICY rfq_inquiries_public_insert ON rfq_inquiries;
    END IF;
    CREATE POLICY rfq_inquiries_public_insert ON rfq_inquiries FOR INSERT WITH CHECK (status = 'new');
END $$;

-- 3. Fail-Closed PII Protection for RFQ Inquiries:
-- Notice: NO public SELECT policy is defined on rfq_inquiries.
-- Anonymous and public callers cannot read traveler inquiries, protecting traveler emails, phones, and itineraries.
-- Only authenticated backend server queries (using service role / direct database connection) or authorized staff can access quotes.

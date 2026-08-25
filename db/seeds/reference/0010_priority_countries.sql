-- Reference seed 0010 — Priority countries (Q1 ratified: EG / SA / AE / JO / TR active)
-- Source of truth: ISO 3166-1 alpha-2 (official codes only — never invented).
-- Global expansion = data operation, never a migration (AD-12).
BEGIN;

INSERT INTO public.countries (iso2, name_ar, name_en, is_active) VALUES
  ('EG', 'مصر',            'Egypt',       true),
  ('SA', 'السعودية',       'Saudi Arabia', true),
  ('AE', 'الإمارات',       'United Arab Emirates', true),
  ('JO', 'الأردن',         'Jordan',      true),
  ('TR', 'تركيا',          'Türkiye',     true)
ON CONFLICT (iso2) DO UPDATE
  SET name_ar   = EXCLUDED.name_ar,
      name_en   = EXCLUDED.name_en,
      is_active = EXCLUDED.is_active;

COMMIT;

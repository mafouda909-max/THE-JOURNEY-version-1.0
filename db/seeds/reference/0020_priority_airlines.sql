-- Reference seed 0020 — Priority active airlines (Q1 ratified coverage:
-- Egypt · Saudi Arabia · UAE · Jordan · Türkiye).
-- IATA codes below are long-established public carrier codes (verified facts —
-- AD-12 forbids invented codes). Additional carriers join via admin reference
-- tooling with sourced codes; schema stays extensible.
BEGIN;

INSERT INTO public.airlines (name_ar, name_en, iata, is_active) VALUES
  ('الخطوط الجوية المصرية', 'EgyptAir',            'MS', true),
  ('الخطوط السعودية',       'Saudia',              'SV', true),
  ('طيران الإمارات',        'Emirates',            'EK', true),
  ('الاتحاد للطيران',       'Etihad Airways',      'EY', true),
  ('الملكية الأردنية',      'Royal Jordanian',     'RJ', true),
  ('الخطوط التركية',        'Turkish Airlines',    'TK', true)
ON CONFLICT (iata) WHERE public.airlines.iata IS NOT NULL DO UPDATE
  SET name_ar   = EXCLUDED.name_ar,
      name_en   = EXCLUDED.name_en,
      is_active = EXCLUDED.is_active
WHERE public.airlines.iata IS NOT NULL;

COMMIT;

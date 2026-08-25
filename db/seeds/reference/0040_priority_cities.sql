-- Reference seed 0040 — Priority cities (readiness-approved curated names).
-- Slugs MUST stay in sync with src/lib/search/places-fallback.ts.
-- No codes involved (cities carry no IATA). is_popular drives home/fallback discovery.
BEGIN;

INSERT INTO public.cities (country_id, name_ar, name_en, slug, is_popular)
SELECT co.id, v.name_ar, v.name_en, v.slug, v.popular
FROM (VALUES
  ('EG', 'القاهرة',        'Cairo',           'cairo',           true ),
  ('EG', 'الإسكندرية',     'Alexandria',      'alexandria',      false),
  ('EG', 'الجيزة',         'Giza',            'giza',            false),
  ('EG', 'الغردقة',        'Hurghada',        'hurghada',        false),
  ('EG', 'شرم الشيخ',      'Sharm El Sheikh', 'sharm-el-sheikh', false),
  ('SA', 'الرياض',         'Riyadh',          'riyadh',          true ),
  ('SA', 'جدة',            'Jeddah',          'jeddah',          true ),
  ('SA', 'الدمام',         'Dammam',          'dammam',          false),
  ('AE', 'دبي',            'Dubai',           'dubai',           true ),
  ('AE', 'أبوظبي',         'Abu Dhabi',       'abu-dhabi',       false),
  ('AE', 'الشارقة',        'Sharjah',         'sharjah',         false),
  ('JO', 'عمّان',          'Amman',           'amman',           true ),
  ('JO', 'العقبة',         'Aqaba',           'aqaba',           false),
  ('TR', 'إسطنبول',        'Istanbul',        'istanbul',        true ),
  ('TR', 'أنقرة',          'Ankara',          'ankara',          false),
  ('TR', 'أنطاليا',        'Antalya',         'antalya',         false),
  ('TR', 'إزمير',          'İzmir',           'izmir',           false)
) AS v(iso2, name_ar, name_en, slug, popular)
JOIN public.countries co ON co.iso2 = v.iso2
ON CONFLICT (slug) DO UPDATE
  SET name_ar    = EXCLUDED.name_ar,
      name_en    = EXCLUDED.name_en,
      country_id = EXCLUDED.country_id,
      is_popular = EXCLUDED.is_popular;

COMMIT;

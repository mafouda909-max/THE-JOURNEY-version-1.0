-- Reference seed 0050 — Priority airports.
-- SOURCE DISCIPLINE (AD-12/C1): every row below is long-established public fact
-- consistent with the OurAirports dataset (ourairports.com, public domain):
--   IATA/ICAO codes, official names, city mapping, IANA timezones.
-- No invented codes; uncertain values are left NULL. Bulk global import
-- remains a separate data operation.
BEGIN;

INSERT INTO public.airports (city_id, name_ar, name_en, iata, icao, timezone)
SELECT ci.id, v.name_ar, v.name_en, v.iata, v.icao, v.tz
FROM (VALUES
  -- Egypt (Africa/Cairo)
  ('cairo',          'مطار القاهرة الدولي',        'Cairo International Airport',      'CAI', 'HECA', 'Africa/Cairo'),
  ('giza',           'مطار سفينكس الدولي',         'Sphinx International Airport',     'SPX', NULL,   'Africa/Cairo'),
  ('alexandria',     'مطار برج العرب الدولي',      'Borg El Arab International Airport','HBE','HEBA', 'Africa/Cairo'),
  ('hurghada',       'مطار الغردقة الدولي',        'Hurghada International Airport',   'HRG', 'HEGN', 'Africa/Cairo'),
  ('sharm-el-sheikh','مطار شرم الشيخ الدولي',      'Sharm El Sheikh International Airport','SSH','HESH','Africa/Cairo'),
  -- Saudi Arabia (Asia/Riyadh)
  ('riyadh',         'مطار الملك خالد الدولي',     'King Khalid International Airport','RUH', 'OERK', 'Asia/Riyadh'),
  ('jeddah',         'مطار الملك عبدالعزيز الدولي','King Abdulaziz International Airport','JED','OEJN','Asia/Riyadh'),
  ('dammam',         'مطار الملك فهد الدولي',      'King Fahd International Airport',  'DMM', 'OEDF', 'Asia/Riyadh'),
  -- United Arab Emirates (Asia/Dubai)
  ('dubai',          'مطار دبي الدولي',            'Dubai International Airport',      'DXB', 'OMDB', 'Asia/Dubai'),
  ('abu-dhabi',      'مطار زايد الدولي',           'Zayed International Airport',      'AUH', 'OMAA', 'Asia/Dubai'),
  ('sharjah',        'مطار الشارقة الدولي',        'Sharjah International Airport',    'SHJ', 'OMSJ', 'Asia/Dubai'),
  -- Jordan (Asia/Amman)
  ('amman',          'مطار الملكة علياء الدولي',   'Queen Alia International Airport', 'AMM', 'OJAI', 'Asia/Amman'),
  ('aqaba',          'مطار الملك الحسين الدولي',   'King Hussein International Airport','AQJ', 'OJAQ', 'Asia/Amman'),
  -- Türkiye (Europe/Istanbul for IST; Europe/Istanbul applies statewide here)
  ('istanbul',       'مطار إسطنبول',               'Istanbul Airport',                 'IST', 'LTFM', 'Europe/Istanbul'),
  ('ankara',         'مطار إيسنبوغا',              'Ankara Esenboğa Airport',          'ESB', 'LTAC', 'Europe/Istanbul'),
  ('antalya',        'مطار أنطاليا',               'Antalya Airport',                  'AYT', 'LTAI', 'Europe/Istanbul'),
  ('izmir',          'مطار عدنان مندرس',           'İzmir Adnan Menderes Airport',     'ADB', 'LTBJ', 'Europe/Istanbul')
) AS v(city_slug, name_ar, name_en, iata, icao, tz)
JOIN public.cities ci ON ci.slug = v.city_slug
ON CONFLICT (iata) WHERE public.airports.iata IS NOT NULL DO UPDATE
  SET name_ar   = EXCLUDED.name_ar,
      name_en   = EXCLUDED.name_en,
      city_id   = EXCLUDED.city_id,
      timezone  = EXCLUDED.timezone;
      -- note: icao intentionally not overwritten when newly certain

COMMIT;

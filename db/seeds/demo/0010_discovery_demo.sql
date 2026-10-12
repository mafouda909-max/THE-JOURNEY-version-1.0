-- ============================================================================
-- DEMO SEED 0010 — Discovery fixtures (Class 2, AD-12 — SYNTHETIC)
--
-- ⛔ GATE (B9): run ONLY in dev/staging with DEMO_SEED_ENABLED=true.
--    Production must NEVER execute db/seeds/demo/*.
--    Launch gate: SELECT count(*) FROM public.offers WHERE is_demo;  → 0
--    Cleanup:     SELECT public.purge_demo_data();
-- Deterministic UUID namespace: 00000000-0000-4000-8000-0000000000XX
-- ============================================================================

BEGIN;

-- ── Demo agent identities (auth.users rows; mirror trigger fills public.users)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_user_meta_data
)
SELECT
  v.uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  v.email, crypt('demo-only-password', gen_salt('bf')),
  now(), now(), now(),
  jsonb_build_object('role','agent','display_name',v.display_name,'language','ar')
FROM (VALUES
  ('00000000-0000-4000-8000-000000000001'::uuid, 'demo-agent1@demo.local', 'وكيل تجريبي — رحلات الشرق'),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'demo-agent2@demo.local', 'وكيل تجريبي — بوابة العالم'),
  ('00000000-0000-4000-8000-000000000003'::uuid, 'demo-agent3@demo.local', 'وكيل تجريبي — أعمدة السفر')
) AS v(uid, email, display_name)
ON CONFLICT (id) DO NOTHING;

-- Mirror rows created by trg_handle_new_user default is_demo=false (B9:
-- production-safe default). Demo contract requires every demo row flagged —
-- flag the mirror rows for the demo identities explicitly.
UPDATE public.users
SET is_demo = true
WHERE id IN (
  '00000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-000000000002'::uuid,
  '00000000-0000-4000-8000-000000000003'::uuid
);

-- ── Verified demo profiles
INSERT INTO public.agent_profiles (
  id, user_id, display_name, business_name, bio_ar, city_id,
  license_type, specialty_tags, languages_spoken,
  verification_status, verified_at, is_demo
)
SELECT
  v.pid, v.uid, v.display_name, v.business, v.bio,
  (SELECT id FROM public.cities WHERE slug = v.city_slug),
  v.license_type::public.enum_license_type,
  v.tags::text[],
  ARRAY['ar']::text[],
  'verified', now(), true
FROM (VALUES
  ('00000000-0000-4000-8000-000000000011'::uuid,
   '00000000-0000-4000-8000-000000000001'::uuid,
   'وكيل تجريبي — رحلات الشرق', 'وكالة الرحلات الشرقية للسياحة والسفر',
   'وكالة تجريبية متخصصة في برامج تركيا وعمرة. جميع بيانات هذا الملف وهمية لأغراض العرض.',
   'cairo', 'agency', '{تركيا,عمرة,برامج سياحية}'),
  ('00000000-0000-4000-8000-000000000012'::uuid,
   '00000000-0000-4000-8000-000000000002'::uuid,
   'وكيل تجريبي — بوابة العالم', 'بوابة العالم للسفر والسياحة',
   'وكيل تجريبي مستقل لتذاكر الطيران والفنادق. بيانات عرض فقط وليست عروضًا حقيقية.',
   'riyadh', 'individual', '{طيران,فنادق}'),
  ('00000000-0000-4000-8000-000000000013'::uuid,
   '00000000-0000-4000-8000-000000000003'::uuid,
   'وكيل تجريبي — أعمدة السفر', 'أعمدة السفر للخدمات السياحية',
   'وكالة تجريبية للتأشيرات والرحلات البحرية داخل ملف تجريبي معلن.',
   'dubai', 'agency', '{تأشيرات,رحلات بحرية}')
) AS v(pid, uid, display_name, business, bio, city_slug, license_type, tags)
ON CONFLICT (id) DO NOTHING;

-- ── Published demo offers (covers trip types + states incl. expiring-soon)
INSERT INTO public.offers (
  id, agent_id, title_ar, description_ar,
  trip_type, route_type,
  origin_city_id, destination_city_id,
  origin_airport_id, destination_airport_id, airline_id,
  departure_date, return_date, duration_days, flexible_dates,
  price_amount, currency, price_type, price_basis,
  includes, excludes, min_travelers, max_travelers,
  status, valid_from, valid_until, published_at, is_demo
)
SELECT
  v.oid,
  v.aid,
  v.title,
  v.descr,
  v.trip::public.enum_trip_type,
  v.route::public.enum_route_type,
  (SELECT id FROM public.cities WHERE slug = v.from_c),
  (SELECT id FROM public.cities WHERE slug = v.to_c),
  (SELECT id FROM public.airports WHERE iata = v.from_a),
  (SELECT id FROM public.airports WHERE iata = v.to_a),
  (SELECT id FROM public.airlines WHERE iata = v.al),
  v.dep, v.ret, v.dur, v.flex,
  v.price, v.cur::char(3),
  v.ptype::public.enum_price_type,
  v.pbasis::public.enum_price_basis,
  v.inc::text[], v.exc::text[],
  v.min_t, v.max_t,
  'published',
  now() - INTERVAL '2 days',
  now() + (v.valid_days || ' days')::interval,
  now() - INTERVAL '1 day',
  true
FROM (VALUES
  -- Cairo → Istanbul flight (direct, fixed, EGP)
  ('00000000-0000-4000-8000-000000000101'::uuid,
   '00000000-0000-4000-8000-000000000011'::uuid,
   'طيران القاهرة إلى إسطنبول — ذهاب وعودة',
   E'عرض تجريبي: تذاكر طيران مباشرة من القاهرة إلى إسطنبول شاملة الضرائب.\nالمقاعد محدودة والسعر نهائي لكل شخص.',
   'flight', 'direct', 'cairo', 'istanbul', 'CAI', 'IST', 'TK',
   DATE '2026-09-15', DATE '2026-09-22', 8, false,
   18500, 'EGP', 'fixed', 'per_person',
   '{الطيران ذهاب وعودة,ضرائب المطار,وجبة على متن الطائرة}'::text[],
   '{التأشيرة,التأمين السفر}'::text[],
   1, 4, 45),

  -- Riyadh → Dubai package (transit, starting_from, SAR)
  ('00000000-0000-4000-8000-000000000102'::uuid,
   '00000000-0000-4000-8000-000000000012'::uuid,
   'برنامج دبي سياحي — 5 ليالٍ',
   E'عرض تجريبي: برنامج سياحي بدبي يشمل الطيران والإقامة 5 نجوم والتنقلات الداخلية وجولات سياحية.',
   'package', 'transit', 'riyadh', 'dubai', NULL, NULL, 'EK',
   DATE '2026-10-01', DATE '2026-10-06', 6, false,
   3400, 'SAR', 'starting_from', 'per_person',
   '{الطيران,إقامة 5 نجوم,التنقلات,جولة مدينة}'::text[],
   '{الوجبات غير المذكورة,المصاريف الشخصية}'::text[],
   2, 6, 60),

  -- Umrah flexible (Cairo → Jeddah, per_group starting_from, USD)
  ('00000000-0000-4000-8000-000000000103'::uuid,
   '00000000-0000-4000-8000-000000000011'::uuid,
   'برنامج عمرة اقتصادي — مغادرة أسبوعية',
   E'عرض تجريبي: عمرة بمرونة كاملة في التواريخ، إقامة قريبة من الحرم، مواصلات حديثة ومرشد ديني.',
   'umrah', 'direct', 'cairo', 'jeddah', 'CAI', 'JED', 'SV',
   NULL, NULL, 10, true,
   1450, 'USD', 'starting_from', 'per_person',
   '{التأشيرة,الإقامة,المواصلات الداخلية,مرشد}'::text[],
   '{الطعام}'::text[],
   1, NULL, 90),

  -- Visa service (representative destination rule — B8: capital as representative)
  ('00000000-0000-4000-8000-000000000104'::uuid,
   '00000000-0000-4000-8000-000000000013'::uuid,
   'خدمة تأشيرة شنغن — تقديم بالقاهرة',
   E'عرض تجريبي: خدمة استكمال وتقديم ملفات تأشيرة شنغن عبر مركز التقديم بالقاهرة (مدينة تمثيلية لوجهة الخدمة).',
   'visa', NULL, 'cairo', 'cairo', NULL, NULL, NULL,
   NULL, NULL, NULL, true,
   7500, 'EGP', 'fixed', 'per_person',
   '{حجز الموعد,مراجعة الملف,تعقب الحالة}'::text[],
   '{رسوم السفارة,مواصلات}'::text[],
   1, NULL, 30),

  -- Hotel-only Antalya (TOTAL basis) — B8: hotel requires DISTINCT cities
  ('00000000-0000-4000-8000-000000000105'::uuid,
   '00000000-0000-4000-8000-000000000012'::uuid,
   'إقامة أنطاليا — منتجع شامل 7 ليالٍ',
   E'عرض تجريبي: حجز فندقي بنظام الكل شامل لعائلة حتى 4 أفراد، إلغاء مجاني قبل 14 يومًا.',
   'hotel', NULL, 'riyadh', 'antalya', NULL, 'AYT', NULL,
   DATE '2026-09-01', DATE '2026-09-08', 8, false,
   1200, 'EUR', 'fixed', 'total',
   '{الإقامة كل شامل,انتقال المطار}'::text[],
   '{الطيران}'::text[],
   2, 4, 40),

  -- EXPIRING SOON fixture (≤7 days → warning pill state c)
  -- B8: cruise requires DISTINCT cities (embarkation ≠ destination)
  ('00000000-0000-4000-8000-000000000106'::uuid,
   '00000000-0000-4000-8000-000000000013'::uuid,
   'رحلة بحرية — أخندق اليونان',
   E'عرض تجريبي: رحلة بحرية 4 ليالٍ بإقامة داخلية، تنطلق من الإسكندرية، ينتهي سريعًا لعرض حالة «ينتهي قريبًا».',
   'cruise', NULL, 'alexandria', 'istanbul', NULL, NULL, NULL,
   DATE '2026-10-20', DATE '2026-10-24', 5, false,
   22000, 'EGP', 'starting_from', 'per_person',
   '{الإقامة الداخلية,الوجبات الرئيسية,ترفيه}'::text[],
   '{الرسوم المينائية,الجولات الاختيارية}'::text[],
   2, 4, 5),

  -- CUSTOM service (B8 representative-city case #2: SAME-city allowed)
  ('00000000-0000-4000-8000-000000000107'::uuid,
   '00000000-0000-4000-8000-000000000011'::uuid,
   'برنامج مخصص حسب الطلب — عائلات',
   E'عرض تجريبي: برنامج سفر مخصص يُصمَّم حسب طلب العائلة، بمدينة انطلاق تمثيلية (القاهرة). جميع التفاصيل قابلة للتخصيص بالكامل.',
   'custom', NULL, 'cairo', 'cairo', NULL, NULL, NULL,
   NULL, NULL, NULL, true,
   9500, 'EGP', 'starting_from', 'per_group',
   '{تصميم البرنامج,مرشد خاص}'::text[],
   '{الطيران الداخلي,التنقلات الاختيارية}'::text[],
   4, 12, 60)
 ) AS v(oid, aid, title, descr, trip, route, from_c, to_c, from_a, to_a, al,
       dep, ret, dur, flex, price, cur, ptype, pbasis, inc, exc, min_t, max_t, valid_days)
ON CONFLICT (id) DO NOTHING;

COMMIT;

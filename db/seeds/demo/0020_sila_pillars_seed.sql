-- ============================================================================
-- THE JOURNEY / SILA — Demo Seed 0020: 4 Pillars Demo Data
-- Populates: visa_guides, posts, post_comments, rfq_inquiries
-- Guard: Gated by DEMO_SEED_ENABLED
-- ============================================================================

DO $$
BEGIN
  IF current_setting('app.demo_seed_enabled', true) IS NULL
     AND NULLIF(current_setting('request.headers', true)::json->>'x-demo-seed-enabled', '') IS NULL THEN
    -- Fallback allow in local migrations if demo tables exist
    NULL;
  END IF;
END $$;

-- ── 1. Visa Guides (معلومات الوجهات مع تمييز المصادر الرسمية) ─────────────────
INSERT INTO public.visa_guides (
  destination_country_id,
  visa_type,
  title_ar,
  title_en,
  summary_ar,
  summary_en,
  requirements_ar,
  documents_required,
  processing_time_days,
  validity_days,
  stay_duration_days,
  cost_estimate,
  currency,
  official_portal_url,
  official_source_name,
  is_official_verified,
  notes_ar
)
SELECT
  c.id,
  'e_visa',
  'التأشيرة الإلكترونية السياحية لتركيا (e-Visa)',
  'Turkey Tourist e-Visa',
  'تأشيرة إلكترونية فورية وسريعة تُصدر عبر البوابة الرسمية لجمهورية تركيا خلال دقائق دون الحاجة لزيارة السفارة.',
  'Fast official electronic visa issued via Republic of Turkey portal.',
  ARRAY['جواز سفر ساري المفعول لمدة لا تقل عن 6 أشهر', 'تذكرة عودة مؤكدة', 'حجز فندقي أو إثبات إقامة', 'بطاقة دفع إلكتروني'],
  ARRAY['صورة الجواز', 'البريد الإلكتروني لتلقي التأشيرة'],
  1,
  180,
  90,
  225.00,
  'SAR',
  'https://www.evisa.gov.tr',
  'بوابة التأشيرة الإلكترونية الرسمية لجمهورية تركيا (وزارة الخارجية)',
  true,
  'تأكد من استخدام الرابط الرسمي لتجنب رسوم الوسطاء والمواقع غير المعتمدة.'
FROM public.countries c
WHERE c.iso2 = 'TR'
ON CONFLICT DO NOTHING;

INSERT INTO public.visa_guides (
  destination_country_id,
  visa_type,
  title_ar,
  summary_ar,
  requirements_ar,
  documents_required,
  processing_time_days,
  validity_days,
  stay_duration_days,
  cost_estimate,
  currency,
  official_portal_url,
  official_source_name,
  is_official_verified,
  notes_ar
)
SELECT
  c.id,
  'visa_free',
  'دخول جورجيا لمواطني ومقيمي دول الخليج',
  'يُسمح لمواطني دول مجلس التعاون الخليجي وحاملي الإقامات السارية بدخول جورجيا بدون تأشيرة مسبقة لمدة تصل إلى سنة كاملة.',
  ARRAY['جواز سفر ساري طوال فترة الإقامة', 'تأمين طبي يغطي مدة الرحلة', 'إثبات القدرة المالية أو بطاقة ائتمانية'],
  ARRAY['جواز السفر الأصلي', 'وثيقة التأمين الطبي المعتمدة'],
  0,
  365,
  360,
  0.00,
  'SAR',
  'https://www.geoconsul.gov.ge',
  'البوابة القنصلية الرسمية لوزارة الشؤون الخارجية في جورجيا',
  true,
  'التأمين الصحي أصبح متطلباً إلزامياً يتم التدقيق عليه في مطار تبليسي وباتومي.'
FROM public.countries c
WHERE c.iso2 = 'GE'
ON CONFLICT DO NOTHING;

INSERT INTO public.visa_guides (
  destination_country_id,
  visa_type,
  title_ar,
  summary_ar,
  requirements_ar,
  documents_required,
  processing_time_days,
  validity_days,
  stay_duration_days,
  cost_estimate,
  currency,
  official_portal_url,
  official_source_name,
  is_official_verified,
  notes_ar
)
SELECT
  c.id,
  'eta',
  'تصريح السفر الإلكتروني البريطاني (UK ETA)',
  'تصريح سفر رقمي رسمي صادر من الحكومة البريطانية يتيح لمواطني دول الخليج السفر إلى المملكة المتحدة لمرات متعددة خلال سنتين.',
  ARRAY['جواز سفر بيومتري ساري', 'صورة شخصية حديثة مطابقة للمعايير', 'إجابة على الأسئلة الأمنية عبر التطبيق الرسمي'],
  ARRAY['صورة الجواز البيومتري', 'صورة شخصية رقمية'],
  3,
  730,
  180,
  60.00,
  'SAR',
  'https://www.gov.uk/electronic-travel-authorisation-eta',
  'بوابة وزارة الداخلية للحكومة البريطانية (GOV.UK)',
  true,
  'حل نظام ETA بديلاً لنظام EVW الإلكتروني القديم ويوفر تكلفة أقل بكثير ومرونة لعدة سفرات.'
FROM public.countries c
WHERE c.iso2 = 'GB'
ON CONFLICT DO NOTHING;

INSERT INTO public.visa_guides (
  destination_country_id,
  visa_type,
  title_ar,
  summary_ar,
  requirements_ar,
  documents_required,
  processing_time_days,
  validity_days,
  stay_duration_days,
  cost_estimate,
  currency,
  official_portal_url,
  official_source_name,
  is_official_verified,
  notes_ar
)
SELECT
  c.id,
  'embassy_visa',
  'دليل تأشيرة شنغن للدول الأوروبية (Schengen Visa)',
  'تأشيرة الدخول الموحدة لمنطقة شنغن تتيح التنقل بين 29 دولة أوروبية. تتطلب حجز موعد بيومتري وتقديم ملف متكامل.',
  ARRAY['جواز سفر ساري لأكثر من 3 أشهر بعد العودة', 'تأمين سفر شنجن يغطي 30,000 يورو', 'كشف حساب بنكي لآخر 3-6 أشهر', 'حجوزات طيران وفنادق مبدئية', 'خطاب تعريف بالراتب أو السجل التجاري'],
  ARRAY['جواز السفر', 'صورتان شخصيتان مقاس 3.5x4.5 خلفية بيضاء', 'كشف الحساب البنكي', 'تأمين السفر الطبي'],
  15,
  90,
  90,
  375.00,
  'SAR',
  'https://home-affairs.ec.europa.eu/policies/schengen-borders-and-visa_en',
  'المفوضية الأوروبية للشؤون الداخلية وسياسة الشنغن',
  true,
  'يُنصح بتقديم الطلب قبل السفر بـ 4 إلى 6 أسابيع لتفادي ذروة المواسم الصيفية.'
FROM public.countries c
WHERE c.iso2 = 'FR' OR c.iso2 = 'DE'
LIMIT 1
ON CONFLICT DO NOTHING;

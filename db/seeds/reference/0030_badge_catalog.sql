-- Reference seed 0030 — Trust-badge catalog (§3.13: every badge carries criteria;
-- never decorative). VERIFIED/LICENSED render primarily from facts (source=derived);
-- the catalog rows standardize rendering copy.
BEGIN;

INSERT INTO public.badges (code, name_ar, name_en, description_ar, description_en, criteria_text, source, icon_key, is_active)
VALUES
  ('verified',
   'وكيل موثّق',
   'Verified Agent',
   'تم التحقق من هوية هذا الوكيل عبر وثائق رسمية.',
   'This agent''s identity has been verified through official documents.',
   'Admin-approved national ID verification request (SPEC §4.3).',
   'derived', 'shield-check', true),
  ('licensed',
   'وكيل مرخّص',
   'Licensed Agent',
   'يحمل هذا الوكيل ترخيص سياحة ساريًا تم التحقق منه.',
   'This agent holds a verified, valid tourism license.',
   'Accepted tourism-license document attached to an approved verification request.',
   'derived', 'license-card', true)
ON CONFLICT (code) DO UPDATE
  SET name_ar = EXCLUDED.name_ar,
      name_en = EXCLUDED.name_en,
      description_ar = EXCLUDED.description_ar,
      description_en = EXCLUDED.description_en,
      criteria_text = EXCLUDED.criteria_text,
      source = EXCLUDED.source,
      icon_key = EXCLUDED.icon_key;

COMMIT;

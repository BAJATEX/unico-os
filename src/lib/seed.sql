BEGIN;

WITH target_org AS (
  SELECT COALESCE(
    (SELECT id FROM public.organizations WHERE slug = 'score-store' LIMIT 1),
    (SELECT id FROM public.organizations WHERE name ILIKE '%score%' ORDER BY created_at ASC NULLS LAST LIMIT 1),
    (SELECT id FROM public.organizations ORDER BY created_at ASC NULLS LAST LIMIT 1)
  ) AS id
)
INSERT INTO public.site_settings (
  organization_id,
  org_id,
  hero_title,
  hero_image,
  promo_active,
  promo_text,
  pixel_id,
  maintenance_mode,
  season_key,
  theme,
  home,
  socials,
  contact_email,
  contact_phone,
  whatsapp_e164,
  whatsapp_display
)
SELECT
  id,
  id,
  'SCORE STORE 2026',
  NULL,
  true,
  '🔥 ENVÍOS NACIONALES E INTERNACIONALES 🔥',
  NULL,
  false,
  'default',
  '{"accent":"#e10600","accent2":"#111111","particles":true}'::jsonb,
  '{"footer_note":"","shipping_note":"","returns_note":"","support_hours":""}'::jsonb,
  jsonb_build_object(
    'facebook', 'https://www.facebook.com/uniforme.unico/',
    'instagram', 'https://www.instagram.com/uniformes.unico',
    'youtube', 'https://youtu.be/F4lw1EcehIA?si=jFBT9skFLs566g8N',
    'tiktok', ''
  ),
  'ventas.unicotextil@gmail.com',
  '6642368701',
  '5216642368701',
  '664 236 8701'
FROM target_org
WHERE id IS NOT NULL
ON CONFLICT (org_id) DO UPDATE
SET
  org_id = EXCLUDED.org_id,
  hero_title = EXCLUDED.hero_title,
  hero_image = EXCLUDED.hero_image,
  promo_active = EXCLUDED.promo_active,
  promo_text = EXCLUDED.promo_text,
  pixel_id = EXCLUDED.pixel_id,
  maintenance_mode = EXCLUDED.maintenance_mode,
  season_key = EXCLUDED.season_key,
  theme = EXCLUDED.theme,
  home = EXCLUDED.home,
  socials = EXCLUDED.socials,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone,
  whatsapp_e164 = EXCLUDED.whatsapp_e164,
  whatsapp_display = EXCLUDED.whatsapp_display,
  updated_at = now();

WITH target_org AS (
  SELECT COALESCE(
    (SELECT id FROM public.organizations WHERE slug = 'score-store' LIMIT 1),
    (SELECT id FROM public.organizations WHERE name ILIKE '%score%' ORDER BY created_at ASC NULLS LAST LIMIT 1),
    (SELECT id FROM public.organizations ORDER BY created_at ASC NULLS LAST LIMIT 1)
  ) AS id
)
INSERT INTO public.products (
  organization_id,
  org_id,
  name,
  description,
  sku,
  base_mxn,
  price_cents,
  price_mxn,
  stock,
  category,
  section_id,
  sub_section,
  rank,
  img,
  image_url,
  images,
  sizes,
  active,
  is_active,
  metadata
)
SELECT
  id,
  id,
  'Gorra SCORE — Demo',
  'Producto demo para validar catálogo, checkout y panel.',
  'SCORE-DEMO-CAP',
  550.00,
  55000,
  550.00,
  25,
  'SCORE',
  'EDICION_2026',
  'Edición 2026',
  1,
  '/icon-512.png',
  '/icon-512.png',
  '[]'::jsonb,
  '[]'::jsonb,
  true,
  true,
  '{}'::jsonb
FROM target_org
WHERE id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.organization_id = (SELECT id FROM target_org)
      AND p.deleted_at IS NULL
  );

COMMIT;
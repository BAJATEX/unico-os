-- =========================================
-- ÚNICO OS / SCORE STORE - SEED
-- =========================================

-- 1) ORGANIZACIÓN MADRE
INSERT INTO organizations (name, slug, created_at)
VALUES ('Score Store', 'score-store', NOW())
ON CONFLICT (slug) DO NOTHING;

-- 2) SETTINGS
INSERT INTO site_settings (org_id, hero_title, promo_active, promo_text, pixel_id)
SELECT id, 'SCORE STORE 2026', true, '🔥 ENVÍOS NACIONALES E INTERNACIONALES 🔥', ''
FROM organizations
WHERE slug = 'score-store'
ON CONFLICT (org_id) DO NOTHING;

-- 3) PRODUCTO DEMO (para no ver panel vacío)
INSERT INTO products (org_id, name, price, stock, category, active, image_url, created_at)
SELECT id, 'Camiseta Baja 1000 - Demo', 550.00, 100, 'BAJA_1000', true, '/assets/logo-score.webp', NOW()
FROM organizations
WHERE slug = 'score-store'
AND NOT EXISTS (
  SELECT 1 FROM products
  WHERE name = 'Camiseta Baja 1000 - Demo'
);

-- 4) (Opcional) MEMBERSHIP para tu usuario
-- PASO:
-- - En Supabase Auth -> Users, copia tu UUID
-- - Pégalo en 'TU_USER_ID_AQUI'
-- - Luego corre esto:

-- INSERT INTO org_memberships (org_id, user_id, role, created_at)
-- SELECT id, 'TU_USER_ID_AQUI', 'owner', NOW()
-- FROM organizations
-- WHERE slug = 'score-store'
-- ON CONFLICT (org_id, user_id) DO UPDATE SET role='owner';
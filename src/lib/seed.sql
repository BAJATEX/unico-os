-- 1. CREAR LA ORGANIZACIÓN "MADRE"
-- Esto es vital. Sin esto, el Admin App no sabe qué cargar.
INSERT INTO organizations (name, slug, created_at)
VALUES ('Score Store', 'score-store', NOW())
ON CONFLICT (slug) DO NOTHING;

-- 2. CREAR LA CONFIGURACIÓN DE LA PÁGINA WEB
-- Esto define el título y la barra de ofertas inicial.
INSERT INTO site_settings (org_id, hero_title, promo_active, promo_text, pixel_id)
SELECT id, 'SCORE STORE 2026', true, '🔥 ENVÍOS NACIONALES E INTERNACIONALES 🔥', ''
FROM organizations WHERE slug = 'score-store'
ON CONFLICT (org_id) DO NOTHING;

-- 3. CREAR UN PRODUCTO DE PRUEBA
-- Esto evita que la tienda se quede "cargando" infinitamente buscando productos.
INSERT INTO products (org_id, name, price, stock, category, active, image_url)
SELECT id, 'Camiseta Baja 1000 - Demo', 550.00, 100, 'BAJA_1000', true, '/assets/logo-score.webp'
FROM organizations WHERE slug = 'score-store'
-- La siguiente línea evita duplicados si corres el script varias veces:
AND NOT EXISTS (
    SELECT 1 FROM products WHERE name = 'Camiseta Baja 1000 - Demo'
);

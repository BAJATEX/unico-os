-- db/unicos_extension.sql
-- =========================================================
-- UNICOS ADMIN EXTENSION v2026-02-26 (Multi-tenant safe)
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.site_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id),
  hero_title text DEFAULT 'SCORE STORE',
  promo_active boolean DEFAULT false,
  promo_text text NULL,
  pixel_id text NULL,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS hero_title text DEFAULT 'SCORE STORE';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS promo_active boolean DEFAULT false;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS promo_text text NULL;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS pixel_id text NULL;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  sku text NULL,
  price_mxn numeric(10,2) NOT NULL DEFAULT 0.00,
  stock integer NOT NULL DEFAULT 0,
  category text DEFAULT 'BAJA_1000',
  image_url text NULL,
  is_active boolean DEFAULT true,
  deleted_at timestamptz NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_products_org ON public.products(organization_id);

DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.products'::regclass
    AND contype='u'
    AND pg_get_constraintdef(oid) ILIKE '%(sku)%'
    AND pg_get_constraintdef(oid) NOT ILIKE '%(organization_id, sku)%'
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.products DROP CONSTRAINT %I', cname);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='products_org_sku_unique_active'
  ) THEN
    EXECUTE $q$
      CREATE UNIQUE INDEX products_org_sku_unique_active
      ON public.products (organization_id, lower(trim(sku)))
      WHERE sku IS NOT NULL AND trim(sku) <> '' AND deleted_at IS NULL
    $q$;
  END IF;
END $$;

DROP POLICY IF EXISTS "Lectura global" ON public.site_settings;
CREATE POLICY "Lectura global" ON public.site_settings
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Lectura global productos" ON public.products;
CREATE POLICY "Lectura global productos" ON public.products
FOR SELECT TO anon, authenticated
USING (deleted_at IS NULL);

INSERT INTO public.site_settings (organization_id, hero_title, promo_active, promo_text)
SELECT id, 'SCORE STORE 2026', true, '🔥 ENVÍOS NACIONALES E INTERNACIONALES 🔥'
FROM public.organizations WHERE name ILIKE '%score%'
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT (organization_id) DO NOTHING;
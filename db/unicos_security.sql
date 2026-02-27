-- =========================================================
-- UNICOS ADMIN - SECURITY & STORAGE PATCH v2026-02-26
-- =========================================================

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "UnicOs subida de fotos" ON storage.objects;
CREATE POLICY "UnicOs subida de fotos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'products');

DROP POLICY IF EXISTS "UnicOs lectura de fotos" ON storage.objects;
CREATE POLICY "UnicOs lectura de fotos"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'products');

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "UnicOs lee organizaciones" ON public.organizations;
CREATE POLICY "UnicOs lee organizaciones"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.admin_users a
    WHERE a.organization_id = organizations.id
      AND a.is_active = true
      AND (
        (a.user_id IS NOT NULL AND a.user_id = auth.uid())
        OR
        (a.email IS NOT NULL AND lower(trim(a.email)) = lower(coalesce(auth.jwt()->>'email', auth.jwt()->'user_metadata'->>'email','')))
      )
  )
);

DROP POLICY IF EXISTS "UnicOs lee admin_users" ON public.admin_users;
CREATE POLICY "UnicOs lee admin_users"
ON public.admin_users
FOR SELECT
TO authenticated
USING (
  (user_id IS NOT NULL AND user_id = auth.uid())
  OR
  (email IS NOT NULL AND lower(trim(email)) = lower(coalesce(auth.jwt()->>'email', auth.jwt()->'user_metadata'->>'email','')))
  OR
  EXISTS (
    SELECT 1
    FROM public.admin_users me
    WHERE me.organization_id = admin_users.organization_id
      AND me.is_active = true
      AND me.role IN ('owner','admin')
      AND (
        (me.user_id IS NOT NULL AND me.user_id = auth.uid())
        OR
        (me.email IS NOT NULL AND lower(trim(me.email)) = lower(coalesce(auth.jwt()->>'email', auth.jwt()->'user_metadata'->>'email','')))
      )
  )
);

DROP POLICY IF EXISTS "UnicOs lee pedidos" ON public.orders;
CREATE POLICY "UnicOs lee pedidos"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.admin_users a
    WHERE a.organization_id = orders.organization_id
      AND a.is_active = true
      AND (
        (a.user_id IS NOT NULL AND a.user_id = auth.uid())
        OR
        (a.email IS NOT NULL AND lower(trim(a.email)) = lower(coalesce(auth.jwt()->>'email', auth.jwt()->'user_metadata'->>'email','')))
      )
  )
);

DROP POLICY IF EXISTS "Lectura global" ON public.site_settings;
CREATE POLICY "Lectura global"
ON public.site_settings
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Lectura global productos" ON public.products;
CREATE POLICY "Lectura global productos"
ON public.products
FOR SELECT
TO anon, authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "UnicOs lee envios" ON public.shipping_labels;
CREATE POLICY "UnicOs lee envios"
ON public.shipping_labels
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.admin_users a
    WHERE a.organization_id = shipping_labels.org_id
      AND a.is_active = true
      AND (
        (a.user_id IS NOT NULL AND a.user_id = auth.uid())
        OR
        (a.email IS NOT NULL AND lower(trim(a.email)) = lower(coalesce(auth.jwt()->>'email', auth.jwt()->'user_metadata'->>'email','')))
      )
  )
);

DROP POLICY IF EXISTS "Roles autorizados actualizan settings" ON public.site_settings;
CREATE POLICY "Roles autorizados actualizan settings"
ON public.site_settings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.admin_users a
    WHERE a.organization_id = site_settings.organization_id
      AND a.role IN ('owner','admin','marketing')
      AND a.is_active = true
      AND (
        (a.user_id IS NOT NULL AND a.user_id = auth.uid())
        OR
        (a.email IS NOT NULL AND lower(trim(a.email)) = lower(coalesce(auth.jwt()->>'email', auth.jwt()->'user_metadata'->>'email','')))
      )
  )
);

DROP POLICY IF EXISTS "Roles autorizados update settings" ON public.site_settings;
CREATE POLICY "Roles autorizados update settings"
ON public.site_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.admin_users a
    WHERE a.organization_id = site_settings.organization_id
      AND a.role IN ('owner','admin','marketing')
      AND a.is_active = true
      AND (
        (a.user_id IS NOT NULL AND a.user_id = auth.uid())
        OR
        (a.email IS NOT NULL AND lower(trim(a.email)) = lower(coalesce(auth.jwt()->>'email', auth.jwt()->'user_metadata'->>'email','')))
      )
  )
);

DROP POLICY IF EXISTS "Owner/Admin actualizan usuarios" ON public.admin_users;
CREATE POLICY "Owner/Admin actualizan usuarios"
ON public.admin_users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.admin_users a
    WHERE a.organization_id = admin_users.organization_id
      AND a.role IN ('owner','admin')
      AND a.is_active = true
      AND (
        (a.user_id IS NOT NULL AND a.user_id = auth.uid())
        OR
        (a.email IS NOT NULL AND lower(trim(a.email)) = lower(coalesce(auth.jwt()->>'email', auth.jwt()->'user_metadata'->>'email','')))
      )
  )
);

DROP POLICY IF EXISTS "Staff inserta productos" ON public.products;
CREATE POLICY "Staff inserta productos"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.admin_users a
    WHERE a.organization_id = products.organization_id
      AND a.role IN ('owner','admin','ops')
      AND a.is_active = true
      AND (
        (a.user_id IS NOT NULL AND a.user_id = auth.uid())
        OR
        (a.email IS NOT NULL AND lower(trim(a.email)) = lower(coalesce(auth.jwt()->>'email', auth.jwt()->'user_metadata'->>'email','')))
      )
  )
);

DROP POLICY IF EXISTS "Staff actualiza productos" ON public.products;
CREATE POLICY "Staff actualiza productos"
ON public.products
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.admin_users a
    WHERE a.organization_id = products.organization_id
      AND a.role IN ('owner','admin','ops')
      AND a.is_active = true
      AND (
        (a.user_id IS NOT NULL AND a.user_id = auth.uid())
        OR
        (a.email IS NOT NULL AND lower(trim(a.email)) = lower(coalesce(auth.jwt()->>'email', auth.jwt()->'user_metadata'->>'email','')))
      )
  )
);

COMMIT;
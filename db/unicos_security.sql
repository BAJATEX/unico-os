-- =========================================================
-- UNICOS ADMIN - SECURITY & STORAGE PATCH v2026
-- =========================================================

-- 1. CREAR EL DISCO DURO (STORAGE) PARA FOTOS DE PRODUCTOS
INSERT INTO storage.buckets (id, name, public) 
VALUES ('products', 'products', true) 
ON CONFLICT (id) DO NOTHING;

-- 2. POLÍTICAS DE STORAGE (Solo admin autenticados pueden subir fotos)
CREATE POLICY "UnicOs subida de fotos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'products');
CREATE POLICY "UnicOs lectura de fotos" ON storage.objects FOR SELECT USING (bucket_id = 'products');

-- 3. POLÍTICAS RLS AVANZADAS (Escritura en Base de Datos)
-- Permite que Owner/Admin revoquen accesos a otros usuarios
CREATE POLICY "Owner/Admin actualizan usuarios" ON public.admin_users FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.admin_users a WHERE a.email = auth.jwt()->>'email' AND a.organization_id = admin_users.organization_id AND a.role IN ('owner', 'admin') AND a.is_active = true)
);

-- Permite que Owner/Admin/Marketing guarden el cintillo de promociones
CREATE POLICY "Roles autorizados actualizan settings" ON public.site_settings FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.admin_users a WHERE a.email = auth.jwt()->>'email' AND a.organization_id = site_settings.organization_id AND a.role IN ('owner', 'admin', 'marketing') AND a.is_active = true)
);

-- Permite que Owner/Admin/Ops creen y modifiquen el Inventario
CREATE POLICY "Staff inserta productos" ON public.products FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.admin_users a WHERE a.email = auth.jwt()->>'email' AND a.organization_id = products.organization_id AND a.role IN ('owner', 'admin', 'ops') AND a.is_active = true)
);
CREATE POLICY "Staff actualiza productos" ON public.products FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.admin_users a WHERE a.email = auth.jwt()->>'email' AND a.organization_id = products.organization_id AND a.role IN ('owner', 'admin', 'ops') AND a.is_active = true)
);
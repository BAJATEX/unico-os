BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.sync_org_alias()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.org_id IS NOT NULL THEN
    NEW.organization_id := NEW.org_id;
  END IF;

  IF NEW.org_id IS NULL AND NEW.organization_id IS NOT NULL THEN
    NEW.org_id := NEW.organization_id;
  END IF;

  IF NEW.organization_id IS NOT NULL THEN
    NEW.org_id := NEW.organization_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.site_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_id uuid,
  hero_title text DEFAULT 'SCORE STORE',
  hero_image text NULL,
  promo_active boolean DEFAULT false,
  promo_text text NULL,
  pixel_id text NULL,
  maintenance_mode boolean DEFAULT false,
  season_key text DEFAULT 'default',
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  home jsonb NOT NULL DEFAULT '{}'::jsonb,
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_email text NULL,
  contact_phone text NULL,
  whatsapp_e164 text NULL,
  whatsapp_display text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS hero_title text DEFAULT 'SCORE STORE',
  ADD COLUMN IF NOT EXISTS hero_image text NULL,
  ADD COLUMN IF NOT EXISTS promo_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_text text NULL,
  ADD COLUMN IF NOT EXISTS pixel_id text NULL,
  ADD COLUMN IF NOT EXISTS maintenance_mode boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS season_key text DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS home jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS contact_email text NULL,
  ADD COLUMN IF NOT EXISTS contact_phone text NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_e164 text NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_display text NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.site_settings
SET org_id = organization_id
WHERE org_id IS NULL AND organization_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS site_settings_org_id_uidx
  ON public.site_settings (org_id);

DROP TRIGGER IF EXISTS trg_site_settings_sync_org_alias ON public.site_settings;
CREATE TRIGGER trg_site_settings_sync_org_alias
BEFORE INSERT OR UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.sync_org_alias();

DROP TRIGGER IF EXISTS trg_site_settings_touch_updated_at ON public.site_settings;
CREATE TRIGGER trg_site_settings_touch_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_id uuid,
  name text NOT NULL,
  description text NULL,
  sku text NULL,
  base_mxn numeric(12,2) NOT NULL DEFAULT 0.00,
  price_cents integer NOT NULL DEFAULT 0,
  price_mxn numeric(12,2) NOT NULL DEFAULT 0.00,
  stock integer NOT NULL DEFAULT 0,
  category text DEFAULT 'BAJA_1000',
  section_id text NULL,
  sub_section text NULL,
  rank integer NOT NULL DEFAULT 0,
  img text NULL,
  image_url text NULL,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS description text NULL,
  ADD COLUMN IF NOT EXISTS base_mxn numeric(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_mxn numeric(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'BAJA_1000',
  ADD COLUMN IF NOT EXISTS section_id text NULL,
  ADD COLUMN IF NOT EXISTS sub_section text NULL,
  ADD COLUMN IF NOT EXISTS rank integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS img text NULL,
  ADD COLUMN IF NOT EXISTS image_url text NULL,
  ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.products
SET
  org_id = COALESCE(org_id, organization_id),
  active = COALESCE(active, is_active, true),
  is_active = COALESCE(is_active, active, true),
  base_mxn = CASE
    WHEN base_mxn IS NOT NULL AND base_mxn > 0 THEN base_mxn
    WHEN price_mxn IS NOT NULL AND price_mxn > 0 THEN price_mxn
    WHEN price_cents IS NOT NULL AND price_cents > 0 THEN (price_cents::numeric / 100)
    ELSE 0.00
  END,
  price_cents = CASE
    WHEN price_cents IS NOT NULL AND price_cents > 0 THEN price_cents
    WHEN price_mxn IS NOT NULL AND price_mxn > 0 THEN ROUND(price_mxn * 100)::int
    WHEN base_mxn IS NOT NULL AND base_mxn > 0 THEN ROUND(base_mxn * 100)::int
    ELSE 0
  END,
  price_mxn = CASE
    WHEN price_mxn IS NOT NULL AND price_mxn > 0 THEN price_mxn
    WHEN price_cents IS NOT NULL AND price_cents > 0 THEN (price_cents::numeric / 100)
    WHEN base_mxn IS NOT NULL AND base_mxn > 0 THEN base_mxn
    ELSE 0.00
  END,
  images = COALESCE(images, '[]'::jsonb),
  sizes = COALESCE(sizes, '[]'::jsonb),
  metadata = COALESCE(metadata, '{}'::jsonb),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

DROP TRIGGER IF EXISTS trg_products_sync_org_alias ON public.products;
CREATE TRIGGER trg_products_sync_org_alias
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_org_alias();

DROP TRIGGER IF EXISTS trg_products_touch_updated_at ON public.products;
CREATE TRIGGER trg_products_touch_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_products_org
  ON public.products (org_id);

CREATE INDEX IF NOT EXISTS idx_products_org_section_rank
  ON public.products (org_id, section_id, rank, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_sku_norm
  ON public.products (org_id, lower(trim(sku)))
  WHERE sku IS NOT NULL AND trim(sku) <> '' AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_id uuid,
  actor_email text NULL,
  actor_user_id uuid NULL,
  action text NOT NULL,
  entity text NULL,
  entity_id text NULL,
  summary text NULL,
  before jsonb NULL,
  after jsonb NULL,
  meta jsonb NULL,
  ip text NULL,
  user_agent text NULL
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS actor_email text NULL,
  ADD COLUMN IF NOT EXISTS actor_user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS entity text NULL,
  ADD COLUMN IF NOT EXISTS entity_id text NULL,
  ADD COLUMN IF NOT EXISTS summary text NULL,
  ADD COLUMN IF NOT EXISTS before jsonb NULL,
  ADD COLUMN IF NOT EXISTS after jsonb NULL,
  ADD COLUMN IF NOT EXISTS meta jsonb NULL,
  ADD COLUMN IF NOT EXISTS ip text NULL,
  ADD COLUMN IF NOT EXISTS user_agent text NULL;

UPDATE public.audit_log
SET org_id = organization_id
WHERE org_id IS NULL AND organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_log_org_created_at_idx
  ON public.audit_log (org_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_audit_log_sync_org_alias ON public.audit_log;
CREATE TRIGGER trg_audit_log_sync_org_alias
BEFORE INSERT OR UPDATE ON public.audit_log
FOR EACH ROW
EXECUTE FUNCTION public.sync_org_alias();

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS org_id uuid NULL REFERENCES public.organizations(id);

UPDATE public.admin_users
SET org_id = COALESCE(org_id, organization_id)
WHERE org_id IS NULL AND organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_users_org_id ON public.admin_users (org_id);

DROP TRIGGER IF EXISTS trg_admin_users_sync_org_alias ON public.admin_users;
CREATE TRIGGER trg_admin_users_sync_org_alias
BEFORE INSERT OR UPDATE ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.sync_org_alias();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS org_id uuid NULL REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS checkout_session_id text NULL,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS customer_email text NULL,
  ADD COLUMN IF NOT EXISTS customer_phone text NULL,
  ADD COLUMN IF NOT EXISTS shipping_country text NULL,
  ADD COLUMN IF NOT EXISTS shipping_postal_code text NULL,
  ADD COLUMN IF NOT EXISTS subtotal_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_subtotal_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_shipping_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_discount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_total_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items_json jsonb NULL,
  ADD COLUMN IF NOT EXISTS customer_details jsonb NULL,
  ADD COLUMN IF NOT EXISTS shipping_details jsonb NULL,
  ADD COLUMN IF NOT EXISTS tracking_number text NULL,
  ADD COLUMN IF NOT EXISTS carrier text NULL,
  ADD COLUMN IF NOT EXISTS shipment_status text NULL,
  ADD COLUMN IF NOT EXISTS shipping_status text NULL,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS envia_cost_mxn numeric(12,2) NULL;

UPDATE public.orders
SET
  org_id = COALESCE(org_id, organization_id),
  checkout_session_id = COALESCE(checkout_session_id, stripe_session_id),
  customer_email = COALESCE(customer_email, email),
  customer_phone = COALESCE(customer_phone, phone),
  shipping_country = COALESCE(shipping_country, 'MX'),
  shipping_postal_code = COALESCE(shipping_postal_code, postal_code),
  subtotal_cents = COALESCE(subtotal_cents, amount_subtotal_cents, 0),
  amount_subtotal_cents = COALESCE(amount_subtotal_cents, subtotal_cents, 0),
  shipping_cents = COALESCE(shipping_cents, amount_shipping_cents, 0),
  amount_shipping_cents = COALESCE(amount_shipping_cents, shipping_cents, 0),
  discount_cents = COALESCE(discount_cents, amount_discount_cents, 0),
  amount_discount_cents = COALESCE(amount_discount_cents, discount_cents, 0),
  total_cents = COALESCE(total_cents, amount_total_cents, 0),
  amount_total_cents = COALESCE(amount_total_cents, total_cents, 0),
  items_json = COALESCE(items_json, '[]'::jsonb),
  customer_details = COALESCE(customer_details, '{}'::jsonb),
  shipping_details = COALESCE(shipping_details, '{}'::jsonb),
  updated_at = COALESCE(updated_at, now());

CREATE INDEX IF NOT EXISTS idx_orders_org_id ON public.orders (org_id);
CREATE INDEX IF NOT EXISTS idx_orders_checkout_session_id ON public.orders (checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON public.orders (tracking_number);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_status ON public.orders (shipping_status);
CREATE INDEX IF NOT EXISTS idx_orders_shipment_status ON public.orders (shipment_status);

DROP TRIGGER IF EXISTS trg_orders_sync_org_alias ON public.orders;
CREATE TRIGGER trg_orders_sync_org_alias
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_org_alias();

DROP TRIGGER IF EXISTS trg_orders_touch_updated_at ON public.orders;
CREATE TRIGGER trg_orders_touch_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.shipping_labels
  ADD COLUMN IF NOT EXISTS org_id uuid NULL,
  ADD COLUMN IF NOT EXISTS order_id uuid NULL,
  ADD COLUMN IF NOT EXISTS stripe_session_id text NULL,
  ADD COLUMN IF NOT EXISTS carrier text NULL,
  ADD COLUMN IF NOT EXISTS service text NULL,
  ADD COLUMN IF NOT EXISTS tracking_number text NULL,
  ADD COLUMN IF NOT EXISTS label_url text NULL,
  ADD COLUMN IF NOT EXISTS shipment_status text NULL,
  ADD COLUMN IF NOT EXISTS shipping_status text NULL,
  ADD COLUMN IF NOT EXISTS envia_cost_mxn numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.shipping_labels
SET org_id = COALESCE(org_id, organization_id)
WHERE org_id IS NULL AND organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shipping_labels_org ON public.shipping_labels (org_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_session ON public.shipping_labels (stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_tracking ON public.shipping_labels (tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_order_id ON public.shipping_labels (order_id);

DROP TRIGGER IF EXISTS trg_shipping_labels_sync_org_alias ON public.shipping_labels;
CREATE TRIGGER trg_shipping_labels_sync_org_alias
BEFORE INSERT OR UPDATE ON public.shipping_labels
FOR EACH ROW
EXECUTE FUNCTION public.sync_org_alias();

DROP TRIGGER IF EXISTS trg_shipping_labels_touch_updated_at ON public.shipping_labels;
CREATE TRIGGER trg_shipping_labels_touch_updated_at
BEFORE UPDATE ON public.shipping_labels
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.shipping_webhooks
  ADD COLUMN IF NOT EXISTS org_id uuid NULL,
  ADD COLUMN IF NOT EXISTS order_id uuid NULL,
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'envia',
  ADD COLUMN IF NOT EXISTS status text NULL,
  ADD COLUMN IF NOT EXISTS tracking_number text NULL,
  ADD COLUMN IF NOT EXISTS stripe_session_id text NULL,
  ADD COLUMN IF NOT EXISTS carrier text NULL,
  ADD COLUMN IF NOT EXISTS raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.shipping_webhooks
SET org_id = COALESCE(org_id, organization_id)
WHERE org_id IS NULL AND organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shipping_webhooks_org ON public.shipping_webhooks (org_id);
CREATE INDEX IF NOT EXISTS idx_shipping_webhooks_tracking ON public.shipping_webhooks (tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipping_webhooks_session ON public.shipping_webhooks (stripe_session_id);

DROP TRIGGER IF EXISTS trg_shipping_webhooks_sync_org_alias ON public.shipping_webhooks;
CREATE TRIGGER trg_shipping_webhooks_sync_org_alias
BEFORE INSERT OR UPDATE ON public.shipping_webhooks
FOR EACH ROW
EXECUTE FUNCTION public.sync_org_alias();

DROP TRIGGER IF EXISTS trg_shipping_webhooks_touch_updated_at ON public.shipping_webhooks;
CREATE TRIGGER trg_shipping_webhooks_touch_updated_at
BEFORE UPDATE ON public.shipping_webhooks
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

COMMIT;
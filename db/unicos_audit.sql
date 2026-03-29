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

CREATE INDEX IF NOT EXISTS audit_log_org_created_at_idx_legacy
  ON public.audit_log (organization_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_audit_log_sync_org_alias ON public.audit_log;
CREATE TRIGGER trg_audit_log_sync_org_alias
BEFORE INSERT OR UPDATE ON public.audit_log
FOR EACH ROW
EXECUTE FUNCTION public.sync_org_alias();

DROP POLICY IF EXISTS "UnicOs lee audit_log" ON public.audit_log;
CREATE POLICY "UnicOs lee audit_log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.admin_users a
    WHERE a.organization_id = audit_log.organization_id
      AND a.is_active = true
      AND a.role IN ('owner','admin')
      AND (
        (a.user_id IS NOT NULL AND a.user_id = auth.uid())
        OR
        (a.email IS NOT NULL AND lower(trim(a.email)) = lower(coalesce(auth.jwt()->>'email', auth.jwt()->'user_metadata'->>'email', '')))
      )
  )
);

DROP POLICY IF EXISTS "Bloquea insert audit_log" ON public.audit_log;
CREATE POLICY "Bloquea insert audit_log"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "Bloquea update audit_log" ON public.audit_log;
CREATE POLICY "Bloquea update audit_log"
ON public.audit_log
FOR UPDATE
TO authenticated
USING (false);

COMMIT;
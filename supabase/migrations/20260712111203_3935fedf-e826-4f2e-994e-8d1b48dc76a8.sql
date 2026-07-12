
-- 1) Restore EXECUTE permission on has_role for authenticated
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- 2) Approval status infrastructure
DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.approval_status NOT NULL DEFAULT 'pending',
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_status TO authenticated;
GRANT ALL ON public.user_status TO service_role;

ALTER TABLE public.user_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own status" ON public.user_status;
CREATE POLICY "Users view own status" ON public.user_status
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage status" ON public.user_status;
CREATE POLICY "Admins manage status" ON public.user_status
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_user_status_updated_at
  BEFORE UPDATE ON public.user_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Approval helper (admins are always approved)
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR EXISTS (
        SELECT 1 FROM public.user_status
        WHERE user_id = _user_id AND status = 'approved'
      );
$$;

GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated;

-- Backfill: existing users become approved so nothing breaks
INSERT INTO public.user_status (user_id, status, approved_at)
SELECT id, 'approved', now() FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 3) Tighten RLS on business tables: require approved status
DROP POLICY IF EXISTS "Users manage own clients" ON public.clients;
CREATE POLICY "Users manage own clients" ON public.clients
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.is_approved(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "Users manage own appointments" ON public.appointments;
CREATE POLICY "Users manage own appointments" ON public.appointments
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.is_approved(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "Users manage own procedures" ON public.procedures;
CREATE POLICY "Users manage own procedures" ON public.procedures
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.is_approved(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_approved(auth.uid()));

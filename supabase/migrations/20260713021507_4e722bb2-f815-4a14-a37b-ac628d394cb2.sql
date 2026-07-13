
-- Move SECURITY DEFINER functions out of the exposed public schema so they
-- are not callable via PostgREST by signed-in users, while keeping them
-- available to RLS policies via a fully-qualified reference.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

-- Recreate has_role in private
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO postgres, service_role;

-- Recreate is_approved in private
CREATE OR REPLACE FUNCTION private.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.has_role(_user_id, 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.user_status
        WHERE user_id = _user_id AND status = 'approved'
      );
$$;

REVOKE ALL ON FUNCTION private.is_approved(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_approved(uuid) TO postgres, service_role;

-- Rewrite policies to reference private.* (functions run as owner via SECURITY DEFINER,
-- so authenticated does not need EXECUTE on them for policy evaluation).

-- audit_logs
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- user_status
DROP POLICY IF EXISTS "Admins manage status" ON public.user_status;
CREATE POLICY "Admins manage status"
ON public.user_status FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users view own status" ON public.user_status;
CREATE POLICY "Users view own status"
ON public.user_status FOR SELECT TO authenticated
USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'::public.app_role));

-- clients
DROP POLICY IF EXISTS "Users manage own clients" ON public.clients;
CREATE POLICY "Users manage own clients"
ON public.clients FOR ALL TO authenticated
USING ((auth.uid() = user_id) AND private.is_approved(auth.uid()))
WITH CHECK ((auth.uid() = user_id) AND private.is_approved(auth.uid()));

-- appointments
DROP POLICY IF EXISTS "Users manage own appointments" ON public.appointments;
CREATE POLICY "Users manage own appointments"
ON public.appointments FOR ALL TO authenticated
USING ((auth.uid() = user_id) AND private.is_approved(auth.uid()))
WITH CHECK ((auth.uid() = user_id) AND private.is_approved(auth.uid()));

-- procedures
DROP POLICY IF EXISTS "Users manage own procedures" ON public.procedures;
CREATE POLICY "Users manage own procedures"
ON public.procedures FOR ALL TO authenticated
USING ((auth.uid() = user_id) AND private.is_approved(auth.uid()))
WITH CHECK ((auth.uid() = user_id) AND private.is_approved(auth.uid()));

-- Drop the public-schema copies now that no policy references them.
DROP FUNCTION IF EXISTS public.is_approved(uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

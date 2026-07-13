
-- Lock down audit_logs writes: only trigger (SECURITY DEFINER) may insert
CREATE POLICY "No direct inserts to audit_logs" ON public.audit_logs FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "No direct updates to audit_logs" ON public.audit_logs FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "No direct deletes from audit_logs" ON public.audit_logs FOR DELETE TO authenticated, anon USING (false);

-- Lock down user_roles writes: only service_role/admin backend may modify
CREATE POLICY "No client inserts to user_roles" ON public.user_roles FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "No client updates to user_roles" ON public.user_roles FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes from user_roles" ON public.user_roles FOR DELETE TO authenticated, anon USING (false);

-- Revoke public EXECUTE on SECURITY DEFINER functions; keep only what's needed
REVOKE ALL ON FUNCTION public.log_audit_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon;

-- has_role and is_approved are used by RLS policies for authenticated users; keep EXECUTE for them
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated;

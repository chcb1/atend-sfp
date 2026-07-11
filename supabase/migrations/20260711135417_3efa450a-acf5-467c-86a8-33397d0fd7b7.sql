
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM PUBLIC, anon, authenticated;

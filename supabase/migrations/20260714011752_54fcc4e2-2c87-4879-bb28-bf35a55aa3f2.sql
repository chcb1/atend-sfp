
DROP POLICY IF EXISTS "Users manage own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users manage own clients" ON public.clients;
DROP POLICY IF EXISTS "Users manage own procedures" ON public.procedures;

CREATE POLICY "Approved users manage appointments" ON public.appointments
FOR ALL TO authenticated
USING (private.is_approved(auth.uid()))
WITH CHECK (private.is_approved(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Approved users manage clients" ON public.clients
FOR ALL TO authenticated
USING (private.is_approved(auth.uid()))
WITH CHECK (private.is_approved(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Approved users manage procedures" ON public.procedures
FOR ALL TO authenticated
USING (private.is_approved(auth.uid()))
WITH CHECK (private.is_approved(auth.uid()) AND auth.uid() = user_id);

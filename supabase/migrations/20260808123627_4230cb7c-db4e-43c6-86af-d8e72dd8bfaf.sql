DROP POLICY IF EXISTS "Approved users manage appointments" ON public.appointments;
DROP POLICY IF EXISTS "Approved users manage clients" ON public.clients;
DROP POLICY IF EXISTS "Approved users manage procedures" ON public.procedures;

CREATE POLICY "Approved users select appointments" ON public.appointments FOR SELECT TO authenticated USING (private.is_approved(auth.uid()));
CREATE POLICY "Approved users insert appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (private.is_approved(auth.uid()) AND auth.uid() = user_id);
CREATE POLICY "Approved users update appointments" ON public.appointments FOR UPDATE TO authenticated USING (private.is_approved(auth.uid())) WITH CHECK (private.is_approved(auth.uid()));
CREATE POLICY "Approved users delete appointments" ON public.appointments FOR DELETE TO authenticated USING (private.is_approved(auth.uid()));

CREATE POLICY "Approved users select clients" ON public.clients FOR SELECT TO authenticated USING (private.is_approved(auth.uid()));
CREATE POLICY "Approved users insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (private.is_approved(auth.uid()) AND auth.uid() = user_id);
CREATE POLICY "Approved users update clients" ON public.clients FOR UPDATE TO authenticated USING (private.is_approved(auth.uid())) WITH CHECK (private.is_approved(auth.uid()));
CREATE POLICY "Approved users delete clients" ON public.clients FOR DELETE TO authenticated USING (private.is_approved(auth.uid()));

CREATE POLICY "Approved users select procedures" ON public.procedures FOR SELECT TO authenticated USING (private.is_approved(auth.uid()));
CREATE POLICY "Approved users insert procedures" ON public.procedures FOR INSERT TO authenticated WITH CHECK (private.is_approved(auth.uid()) AND auth.uid() = user_id);
CREATE POLICY "Approved users update procedures" ON public.procedures FOR UPDATE TO authenticated USING (private.is_approved(auth.uid())) WITH CHECK (private.is_approved(auth.uid()));
CREATE POLICY "Approved users delete procedures" ON public.procedures FOR DELETE TO authenticated USING (private.is_approved(auth.uid()));
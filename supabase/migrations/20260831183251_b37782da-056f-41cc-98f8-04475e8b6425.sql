CREATE TABLE public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  expenses_open_to_all_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users select app_settings" ON public.app_settings
  FOR SELECT TO authenticated USING (private.is_approved(auth.uid()));
CREATE POLICY "Admins update app_settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (id) VALUES (true);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  description text NOT NULL,
  category text,
  amount numeric NOT NULL CHECK (amount > 0),
  expense_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Expenses select" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR ((SELECT s.expenses_open_to_all_approved FROM public.app_settings s WHERE s.id) AND private.is_approved(auth.uid()))
  );

CREATE POLICY "Expenses insert" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      private.has_role(auth.uid(), 'admin'::app_role)
      OR ((SELECT s.expenses_open_to_all_approved FROM public.app_settings s WHERE s.id) AND private.is_approved(auth.uid()))
    )
  );

CREATE POLICY "Expenses update" ON public.expenses
  FOR UPDATE TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR ((SELECT s.expenses_open_to_all_approved FROM public.app_settings s WHERE s.id) AND private.is_approved(auth.uid()))
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR ((SELECT s.expenses_open_to_all_approved FROM public.app_settings s WHERE s.id) AND private.is_approved(auth.uid()))
  );

CREATE POLICY "Expenses delete" ON public.expenses
  FOR DELETE TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR ((SELECT s.expenses_open_to_all_approved FROM public.app_settings s WHERE s.id) AND private.is_approved(auth.uid()))
  );

CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
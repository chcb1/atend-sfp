CREATE TABLE public.procedures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedures TO authenticated;
GRANT ALL ON public.procedures TO service_role;

ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own procedures" ON public.procedures
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_procedures_updated_at
  BEFORE UPDATE ON public.procedures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX procedures_user_name_idx ON public.procedures(user_id, name);

ALTER TABLE public.appointments
  ADD COLUMN procedure_id UUID REFERENCES public.procedures(id) ON DELETE SET NULL;

CREATE INDEX appointments_procedure_id_idx ON public.appointments(procedure_id);

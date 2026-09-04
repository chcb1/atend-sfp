CREATE TYPE public.expense_status AS ENUM ('pendente', 'paga', 'cancelada');

ALTER TABLE public.expenses
  ADD COLUMN status public.expense_status NOT NULL DEFAULT 'pendente',
  ADD COLUMN recurrence_group_id uuid,
  ADD COLUMN installment_number integer,
  ADD COLUMN installment_total integer;

UPDATE public.expenses
SET status = CASE WHEN expense_date > CURRENT_DATE THEN 'pendente'::public.expense_status ELSE 'paga'::public.expense_status END;

CREATE INDEX IF NOT EXISTS expenses_status_date_idx ON public.expenses (status, expense_date);
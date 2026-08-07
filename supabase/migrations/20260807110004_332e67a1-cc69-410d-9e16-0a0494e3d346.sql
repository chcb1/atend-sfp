-- 1. Enum de status
DO $$ BEGIN
  CREATE TYPE public.appointment_status AS ENUM ('agendado', 'concluido', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Novas colunas
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS status public.appointment_status NOT NULL DEFAULT 'agendado',
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 60;

-- 3. Backfill: registros existentes viram 'concluido' com horario a partir de date as 12:00,
--    escalonados em sequencia quando ha varios no mesmo dia (evita sobreposicao)
WITH ordered AS (
  SELECT id,
         date,
         row_number() OVER (PARTITION BY date ORDER BY created_at, id) - 1 AS seq
  FROM public.appointments
  WHERE scheduled_at IS NULL
)
UPDATE public.appointments a
SET status = 'concluido',
    scheduled_at = ((o.date + time '12:00') AT TIME ZONE 'America/Sao_Paulo')
                   + (o.seq * interval '60 minutes')
FROM ordered o
WHERE a.id = o.id;

-- 4. Funcao de validacao de conflito de horario
CREATE OR REPLACE FUNCTION public.check_appointment_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_conflict_id uuid;
  v_duration integer;
BEGIN
  IF NEW.scheduled_at IS NULL OR NEW.status = 'cancelado' THEN
    RETURN NEW;
  END IF;

  v_duration := COALESCE(NEW.duration_minutes, 60);

  SELECT a.id INTO v_conflict_id
  FROM public.appointments a
  WHERE a.id <> NEW.id
    AND a.scheduled_at IS NOT NULL
    AND a.status IN ('agendado', 'concluido')
    AND tstzrange(a.scheduled_at,
                  a.scheduled_at + (COALESCE(a.duration_minutes, 60) * interval '1 minute'),
                  '[)')
        && tstzrange(NEW.scheduled_at,
                     NEW.scheduled_at + (v_duration * interval '1 minute'),
                     '[)')
  LIMIT 1;

  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Conflito de horário com outro atendimento'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_no_overlap ON public.appointments;
CREATE TRIGGER appointments_no_overlap
  BEFORE INSERT OR UPDATE OF scheduled_at, duration_minutes, status
  ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_appointment_overlap();

-- 5. Indice de apoio para a busca de conflitos
CREATE INDEX IF NOT EXISTS appointments_scheduled_at_idx
  ON public.appointments (scheduled_at)
  WHERE scheduled_at IS NOT NULL;
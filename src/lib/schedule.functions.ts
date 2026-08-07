import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Appointment } from "./types";

const scheduleInput = z.object({
  client_id: z.string().uuid().nullable().optional(),
  client_name: z.string().trim().min(1, "Cliente é obrigatório"),
  procedure_id: z.string().uuid().nullable().optional(),
  procedure: z.string().trim().min(1, "Procedimento é obrigatório"),
  scheduled_at: z.string().min(1, "Data/hora é obrigatória"),
  duration_minutes: z.number().int().positive().default(60),
  gross_value: z.number().nonnegative().default(0),
  expenses: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  notes: z.string().trim().optional().nullable(),
  status: z.enum(["agendado", "concluido", "cancelado"]).default("agendado"),
});

function dateOnly(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

/** Repassa a mensagem do trigger de conflito de forma legível ao frontend. */
function toClientError(message: string): Error {
  if (message.includes("Conflito de horário")) {
    return new Error("Conflito de horário com outro atendimento");
  }
  return new Error(message);
}

export const listSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ from: z.string().min(1), to: z.string().min(1) }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<Appointment[]> => {
    const { data: rows, error } = await (context.supabase as any)
      .from("appointments")
      .select("*")
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", data.from)
      .lt("scheduled_at", data.to)
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as Appointment[];
  });

export const createScheduledAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => scheduleInput.parse(raw))
  .handler(async ({ data, context }): Promise<Appointment> => {
    const payload = {
      user_id: context.userId,
      date: dateOnly(data.scheduled_at),
      scheduled_at: data.scheduled_at,
      duration_minutes: data.duration_minutes ?? 60,
      status: data.status ?? "agendado",
      client_id: data.client_id || null,
      client_name: data.client_name,
      procedure_id: data.procedure_id || null,
      procedure: data.procedure,
      gross_value: data.gross_value ?? 0,
      expenses: data.expenses ?? 0,
      tax: data.tax ?? 0,
      notes: data.notes || null,
    };
    const { data: row, error } = await (context.supabase as any)
      .from("appointments")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw toClientError(error.message);
    return row as Appointment;
  });

export const updateScheduledAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => scheduleInput.extend({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<Appointment> => {
    const { id, ...rest } = data;
    const { data: row, error } = await (context.supabase as any)
      .from("appointments")
      .update({
        date: dateOnly(rest.scheduled_at),
        scheduled_at: rest.scheduled_at,
        duration_minutes: rest.duration_minutes ?? 60,
        status: rest.status ?? "agendado",
        client_id: rest.client_id || null,
        client_name: rest.client_name,
        procedure_id: rest.procedure_id || null,
        procedure: rest.procedure,
        gross_value: rest.gross_value ?? 0,
        expenses: rest.expenses ?? 0,
        tax: rest.tax ?? 0,
        notes: rest.notes || null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw toClientError(error.message);
    return row as Appointment;
  });

export const cancelAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<Appointment> => {
    const { data: row, error } = await (context.supabase as any)
      .from("appointments")
      .update({ status: "cancelado" })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw toClientError(error.message);
    return row as Appointment;
  });

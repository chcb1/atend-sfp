import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Appointment } from "./types";

const apptInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  client_id: z.string().uuid().nullable().optional(),
  client_name: z.string().trim().min(1, "Cliente é obrigatório"),
  procedure_id: z.string().uuid().nullable().optional(),
  procedure: z.string().trim().min(1, "Procedimento é obrigatório"),
  gross_value: z.number().nonnegative(),
  expenses: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  notes: z.string().trim().optional().nullable(),
});

const filters = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    client_id: z.string().uuid().optional(),
    procedure: z.string().optional(),
    search: z.string().optional(),
  })
  .optional();

export const listAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => filters.parse(raw))
  .handler(async ({ data, context }): Promise<Appointment[]> => {
    let q = (context.supabase as any)
      .from("appointments")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (data?.from) q = q.gte("date", data.from);
    if (data?.to) q = q.lte("date", data.to);
    if (data?.client_id) q = q.eq("client_id", data.client_id);
    if (data?.procedure) q = q.ilike("procedure", `%${data.procedure}%`);
    if (data?.search) {
      q = q.or(
        `client_name.ilike.%${data.search}%,procedure.ilike.%${data.search}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as Appointment[];
  });

export const getAppointment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<Appointment | null> => {
    const { data: row, error } = await (context.supabase as any)
      .from("appointments")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row ?? null) as Appointment | null;
  });

export const createAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => apptInput.parse(raw))
  .handler(async ({ data, context }): Promise<Appointment> => {
    const { findFreeNoonSlot } = await import("./appointment-slot.server");
    const scheduledAt = await findFreeNoonSlot(context.supabase, data.date, 60);
    const payload = {
      user_id: context.userId,
      date: data.date,
      status: "concluido" as const,
      scheduled_at: scheduledAt,
      duration_minutes: 60,
      client_id: data.client_id || null,
      client_name: data.client_name,
      procedure_id: data.procedure_id || null,
      procedure: data.procedure,
      gross_value: data.gross_value,
      expenses: data.expenses ?? 0,
      tax: data.tax ?? 0,
      notes: data.notes || null,
    };
    const { data: row, error } = await (context.supabase as any)
      .from("appointments")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Appointment;
  });

export const updateAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => apptInput.extend({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<Appointment> => {
    const { id, ...rest } = data;
    const { findFreeNoonSlot, saoPauloHourUtc } = await import("./appointment-slot.server");

    const { data: current, error: currentError } = await (context.supabase as any)
      .from("appointments")
      .select("status, scheduled_at, duration_minutes, date")
      .eq("id", id)
      .maybeSingle();
    if (currentError) throw new Error(currentError.message);

    const duration = current?.duration_minutes ?? 60;
    const dayStart = saoPauloHourUtc(rest.date, 0).getTime();
    const sameDay =
      current?.scheduled_at != null &&
      new Date(current.scheduled_at).getTime() >= dayStart &&
      new Date(current.scheduled_at).getTime() < dayStart + 24 * 60 * 60000;

    // Este formulário registra atendimentos já realizados; mantém agenda coerente.
    const scheduledAt = sameDay
      ? current.scheduled_at
      : await findFreeNoonSlot(context.supabase, rest.date, duration, id);

    const { data: row, error } = await (context.supabase as any)
      .from("appointments")
      .update({
        date: rest.date,
        status: current?.status ?? "concluido",
        scheduled_at: scheduledAt,
        duration_minutes: duration,
        client_id: rest.client_id || null,
        client_name: rest.client_name,
        procedure_id: rest.procedure_id || null,
        procedure: rest.procedure,
        gross_value: rest.gross_value,
        expenses: rest.expenses ?? 0,
        tax: rest.tax ?? 0,
        notes: rest.notes || null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Appointment;
  });


export const deleteAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("appointments")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

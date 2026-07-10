import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Procedure } from "./types";

const procInput = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  description: z.string().trim().optional().nullable(),
  default_value: z.number().nonnegative().default(0),
});

export const listProcedures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Procedure[]> => {
    const { data, error } = await (context.supabase as any)
      .from("procedures")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Procedure[];
  });

export const createProcedure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => procInput.parse(raw))
  .handler(async ({ data, context }): Promise<Procedure> => {
    const payload = {
      user_id: context.userId,
      name: data.name,
      description: data.description || null,
      default_value: data.default_value ?? 0,
    };
    const { data: row, error } = await (context.supabase as any)
      .from("procedures")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Procedure;
  });

export const updateProcedure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => procInput.extend({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<Procedure> => {
    const { id, ...rest } = data;
    const { data: row, error } = await (context.supabase as any)
      .from("procedures")
      .update({
        name: rest.name,
        description: rest.description || null,
        default_value: rest.default_value ?? 0,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Procedure;
  });

export const deleteProcedure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("procedures")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

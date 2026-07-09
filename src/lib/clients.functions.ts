import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Client } from "./types";

const clientInput = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")).nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Client[]> => {
    const { data, error } = await (context.supabase as any)
      .from("clients")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Client[];
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => clientInput.parse(raw))
  .handler(async ({ data, context }): Promise<Client> => {
    const payload = {
      user_id: context.userId,
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      notes: data.notes || null,
    };
    const { data: row, error } = await (context.supabase as any)
      .from("clients")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Client;
  });

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => clientInput.extend({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<Client> => {
    const { id, ...rest } = data;
    const { data: row, error } = await (context.supabase as any)
      .from("clients")
      .update({
        name: rest.name,
        phone: rest.phone || null,
        email: rest.email || null,
        notes: rest.notes || null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Client;
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("clients")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

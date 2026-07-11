import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AuditLog = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  entity: string;
  entity_id: string | null;
  changes: any;
  created_at: string;
};

const filters = z
  .object({
    entity: z.string().optional(),
    action: z.enum(["INSERT", "UPDATE", "DELETE"]).optional(),
    user_email: z.string().optional(),
    limit: z.number().int().min(1).max(500).optional(),
  })
  .optional();

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => filters.parse(raw))
  .handler(async ({ data, context }): Promise<AuditLog[]> => {
    let q = (context.supabase as any)
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 200);

    if (data?.entity) q = q.eq("entity", data.entity);
    if (data?.action) q = q.eq("action", data.action);
    if (data?.user_email) q = q.ilike("user_email", `%${data.user_email}%`);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as AuditLog[];
  });

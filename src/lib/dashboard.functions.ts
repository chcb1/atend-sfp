import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Appointment, DashboardStats } from "./types";

const filters = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .optional();

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => filters.parse(raw))
  .handler(async ({ data, context }): Promise<DashboardStats> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRow } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden: admin only");

    let q = (context.supabase as any)
      .from("appointments")
      .select("*")
      // só atendimentos realizados entram no painel consolidado
      .eq("status", "concluido")
      .order("date", { ascending: false });
    if (data?.from) q = q.gte("date", data.from);
    if (data?.to) q = q.lte("date", data.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Appointment[];

    const totals = list.reduce(
      (acc, r) => {
        acc.gross += Number(r.gross_value);
        acc.exp += Number(r.expenses);
        acc.tax += Number(r.tax);
        acc.net += Number(r.net_value);
        return acc;
      },
      { gross: 0, exp: 0, tax: 0, net: 0 },
    );

    const byMonthMap = new Map<string, { net: number; gross: number }>();
    const byProcMap = new Map<string, number>();
    const byClientMap = new Map<string, { net: number; count: number }>();

    for (const r of list) {
      const month = r.date.slice(0, 7); // YYYY-MM
      const m = byMonthMap.get(month) ?? { net: 0, gross: 0 };
      m.net += Number(r.net_value);
      m.gross += Number(r.gross_value);
      byMonthMap.set(month, m);

      byProcMap.set(
        r.procedure,
        (byProcMap.get(r.procedure) ?? 0) + Number(r.net_value),
      );

      const c = byClientMap.get(r.client_name) ?? { net: 0, count: 0 };
      c.net += Number(r.net_value);
      c.count += 1;
      byClientMap.set(r.client_name, c);
    }

    const byMonth = Array.from(byMonthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v }));

    const byProcedure = Array.from(byProcMap.entries())
      .map(([procedure, net]) => ({ procedure, net }))
      .sort((a, b) => b.net - a.net);

    const topClients = Array.from(byClientMap.entries())
      .map(([client, v]) => ({ client, ...v }))
      .sort((a, b) => b.net - a.net)
      .slice(0, 5);

    return {
      totalGross: totals.gross,
      totalExpenses: totals.exp,
      totalTax: totals.tax,
      totalNet: totals.net,
      count: list.length,
      averageTicket: list.length ? totals.net / list.length : 0,
      activeClients: byClientMap.size,
      byMonth,
      byProcedure,
      topClients,
      recent: list.slice(0, 5),
    };
  });

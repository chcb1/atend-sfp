import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Appointment, DashboardStats, ForecastStats, ForecastWindow } from "./types";

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

    // Provisão futura: mês atual + 2 meses seguintes, independente do filtro
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 3, 1);
    const monthKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const futureMonths = [0, 1, 2].map((i) =>
      monthKey(new Date(now.getFullYear(), now.getMonth() + i, 1)),
    );

    const { data: schedRows } = await (context.supabase as any)
      .from("appointments")
      .select("net_value, scheduled_at")
      .eq("status", "agendado")
      .gte("scheduled_at", startMonth.toISOString())
      .lt("scheduled_at", endMonth.toISOString());

    const provMap = new Map<string, number>(futureMonths.map((m) => [m, 0]));
    for (const r of (schedRows ?? []) as { net_value: number; scheduled_at: string | null }[]) {
      if (!r.scheduled_at) continue;
      const k = monthKey(new Date(r.scheduled_at));
      if (provMap.has(k)) provMap.set(k, (provMap.get(k) ?? 0) + Number(r.net_value));
    }

    const monthKeys = new Set<string>([...byMonthMap.keys(), ...futureMonths]);
    const byMonth = Array.from(monthKeys)
      .sort((a, b) => a.localeCompare(b))
      .map((month) => ({
        month,
        net: byMonthMap.get(month)?.net ?? 0,
        gross: byMonthMap.get(month)?.gross ?? 0,
        provisionedNet: provMap.get(month) ?? 0,
      }));

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

export const getForecastStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ForecastStats> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRow } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden: admin only");

    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { data: rows, error } = await (context.supabase as any)
      .from("appointments")
      .select("*")
      .eq("status", "agendado")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", in30.toISOString())
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Appointment[];

    const sum = (items: Appointment[]): ForecastWindow =>
      items.reduce(
        (acc, r) => {
          acc.gross += Number(r.gross_value);
          acc.net += Number(r.net_value);
          acc.count += 1;
          return acc;
        },
        { gross: 0, net: 0, count: 0 },
      );

    const within7 = list.filter((r) => r.scheduled_at && new Date(r.scheduled_at) <= in7);

    return {
      next7: sum(within7),
      next30: sum(list),
      upcoming: list.slice(0, 5).map((r) => ({
        id: r.id,
        scheduled_at: r.scheduled_at ?? "",
        client_name: r.client_name,
        procedure: r.procedure,
        gross_value: Number(r.gross_value),
        net_value: Number(r.net_value),
      })),
    };
  });

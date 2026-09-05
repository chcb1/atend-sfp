import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Expense } from "./types";

const expenseInput = z.object({
  description: z.string().trim().min(1, "Descrição é obrigatória"),
  category: z.string().trim().optional().nullable(),
  amount: z.number().positive("Valor deve ser maior que zero"),
  expense_date: z.string().min(1, "Data é obrigatória"),
  status: z.enum(["pendente", "paga", "cancelada"]).optional(),
});

/** Status padrão: futura nasce pendente, hoje/passada nasce paga */
function defaultStatus(expenseDate: string) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return expenseDate > today ? "pendente" : "paga";
}


export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Expense[]> => {
    const { data, error } = await (context.supabase as any)
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Expense[];
  });

export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => expenseInput.parse(raw))
  .handler(async ({ data, context }): Promise<Expense> => {
    const { data: row, error } = await (context.supabase as any)
      .from("expenses")
      .insert({
        user_id: context.userId,
        description: data.description,
        category: data.category || null,
        amount: data.amount,
        expense_date: data.expense_date,
        status: data.status ?? defaultStatus(data.expense_date),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Expense;
  });

export const updateExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => expenseInput.extend({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<Expense> => {
    const { data: row, error } = await (context.supabase as any)
      .from("expenses")
      .update({
        description: data.description,
        category: data.category || null,
        amount: data.amount,
        expense_date: data.expense_date,
        ...(data.status ? { status: data.status } : {}),
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Expense;
  });

export const setExpenseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["pendente", "paga", "cancelada"]) })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<Expense> => {
    const { data: row, error } = await (context.supabase as any)
      .from("expenses")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Expense;
  });


export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("expenses")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Soma meses preservando o dia, tratando overflow (31/01 + 1 mês = 28/02) */
function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const targetMonthIndex = (m as number) - 1 + months;
  const year = (y as number) + Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d as number, daysInMonth);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const recurringInput = z.object({
  mode: z.enum(["recorrente", "parcelado"]),
  description: z.string().trim().min(1, "Descrição é obrigatória"),
  category: z.string().trim().optional().nullable(),
  amount: z.number().positive("Valor deve ser maior que zero"),
  expense_date: z.string().min(1, "Data é obrigatória"),
  occurrences: z.number().int().min(2, "Informe ao menos 2 lançamentos").max(120),
});

export const createRecurringExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => recurringInput.parse(raw))
  .handler(async ({ data, context }): Promise<Expense[]> => {
    const n = data.occurrences;
    const groupId = crypto.randomUUID();

    let amounts: number[];
    if (data.mode === "recorrente") {
      amounts = Array.from({ length: n }, () => Math.round(data.amount * 100) / 100);
    } else {
      const totalCents = Math.round(data.amount * 100);
      const base = Math.floor(totalCents / n);
      amounts = Array.from({ length: n }, (_, i) =>
        (i === n - 1 ? base + (totalCents - base * n) : base) / 100,
      );
    }

    const rows = amounts.map((amount, i) => {
      const date = addMonthsISO(data.expense_date, i);
      return {
        user_id: context.userId,
        description: data.description,
        category: data.category || null,
        amount,
        expense_date: date,
        status: defaultStatus(date),
        recurrence_group_id: groupId,
        installment_number: i + 1,
        installment_total: n,
      };
    });

    const { data: inserted, error } = await (context.supabase as any)
      .from("expenses")
      .insert(rows)
      .select("*");
    if (error) throw new Error(error.message);
    return (inserted ?? []) as Expense[];
  });

/** Cancela parcelas futuras pendentes do mesmo grupo */
export const cancelRemainingInstallments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ recurrence_group_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<{ cancelled: number }> => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const { data: rows, error } = await (context.supabase as any)
      .from("expenses")
      .update({ status: "cancelada" })
      .eq("recurrence_group_id", data.recurrence_group_id)
      .eq("status", "pendente")
      .gt("expense_date", today)
      .select("id");
    if (error) throw new Error(error.message);
    return { cancelled: (rows ?? []).length };
  });


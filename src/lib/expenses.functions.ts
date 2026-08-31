import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Expense } from "./types";

const expenseInput = z.object({
  description: z.string().trim().min(1, "Descrição é obrigatória"),
  category: z.string().trim().optional().nullable(),
  amount: z.number().positive("Valor deve ser maior que zero"),
  expense_date: z.string().min(1, "Data é obrigatória"),
});

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
      })
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

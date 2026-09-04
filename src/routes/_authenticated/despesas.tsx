import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  setExpenseStatus,
} from "@/lib/expenses.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES: string[] = [
  "Material de consumo",
  "Equipamento",
  "Manutenção",
  "Aluguel",
  "Impostos e taxas",
  "Marketing",
  "Software / Assinaturas",
  "Outros",
];
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Receipt, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { Expense, ExpenseStatus } from "@/lib/types";
import { brl } from "@/lib/format";

const STATUS_LABEL: Record<ExpenseStatus, string> = {
  pendente: "Pendente",
  paga: "Paga",
  cancelada: "Cancelada",
};

const STATUS_CLASS: Record<ExpenseStatus, string> = {
  pendente: "border-amber-500 text-amber-700 dark:text-amber-400",
  paga: "border-emerald-500 text-emerald-700 dark:text-emerald-400",
  cancelada: "border-muted text-muted-foreground line-through",
};

export const Route = createFileRoute("/_authenticated/despesas")({
  component: ExpensesPage,
  head: () => ({
    meta: [
      { title: "Despesas | Fisio App" },
      {
        name: "description",
        content:
          "Cadastre e acompanhe as despesas da clínica, como material, equipamento e aluguel.",
      },
      { property: "og:title", content: "Despesas | Fisio App" },
      {
        property: "og:description",
        content: "Controle das despesas da clínica, com situação de pagamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <div className="text-destructive">{error.message}</div>,
  notFoundComponent: () => <div>Nada encontrado.</div>,
});


function todayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function formatDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function ExpensesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listExpenses);
  const changeStatus = useServerFn(setExpenseStatus);
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => list(),
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const statusMutation = useMutation({
    mutationFn: (v: { id: string; status: ExpenseStatus }) => changeStatus({ data: v }),
    onSuccess: () => {
      toast.success("Situação atualizada");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["forecast"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = expenses
    .filter((e) => e.status === "paga")
    .reduce((s, e) => s + Number(e.amount), 0);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Despesas</h1>
          <p className="text-sm text-muted-foreground">
            Material, equipamento, aluguel e outros custos que não estão embutidos nos atendimentos
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setEditOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Nova despesa
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <Receipt className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma despesa cadastrada ainda.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="tabular-nums">{formatDate(e.expense_date)}</TableCell>
                    <TableCell className="font-medium">{e.description}</TableCell>
                    <TableCell className="text-muted-foreground">{e.category || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_CLASS[e.status]}>
                        {STATUS_LABEL[e.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{brl(Number(e.amount))}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {e.status === "pendente" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Marcar como paga"
                          disabled={statusMutation.isPending}
                          onClick={() => statusMutation.mutate({ id: e.id, status: "paga" })}
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(e);
                          setEditOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(e.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} className="font-medium">
                    Total pago no período listado
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{brl(total)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>


      <ExpenseForm
        open={editOpen}
        onOpenChange={setEditOpen}
        expense={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["expenses"] })}
      />

      <DeleteExpenseDialog
        id={deleteId}
        onClose={() => setDeleteId(null)}
        onDeleted={() => qc.invalidateQueries({ queryKey: ["expenses"] })}
      />
    </div>
  );
}

function ExpenseForm({
  open,
  onOpenChange,
  expense,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  expense: Expense | null;
  onSaved?: () => void;
}) {
  const create = useServerFn(createExpense);
  const update = useServerFn(updateExpense);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());

  useEffect(() => {
    if (open) {
      setDescription(expense?.description ?? "");
      setCategory(expense?.category ?? "");
      setAmount(expense ? String(expense.amount) : "");
      setDate(expense?.expense_date ?? todayISO());
    }
  }, [open, expense]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        description,
        category: category || null,
        amount: parseFloat(amount) || 0,
        expense_date: date,
      };
      if (expense) return update({ data: { id: expense.id, ...payload } });
      return create({ data: payload });
    },
    onSuccess: () => {
      toast.success(expense ? "Despesa atualizada" : "Despesa cadastrada");
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{expense ? "Editar despesa" : "Nova despesa"}</DialogTitle>
          <DialogDescription>
            Despesas avulsas não afetam o valor líquido dos atendimentos.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="e-desc">Descrição *</Label>
            <Input
              id="e-desc"
              value={description}
              onChange={(ev) => setDescription(ev.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-cat">Categoria</Label>
            <Select
              value={CATEGORIES.includes(category) ? category : category ? "Outros" : ""}
              onValueChange={(v) => setCategory(v)}
            >
              <SelectTrigger id="e-cat">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {category && !CATEGORIES.includes(category) && (
              <p className="text-xs text-muted-foreground">
                Valor atual: “{category}”. Escolha uma opção para substituir.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="e-amount">Valor *</Label>
              <CurrencyInput
                id="e-amount"
                value={parseFloat(amount) || 0}
                onValueChange={(v) => setAmount(String(v))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-date">Data *</Label>
              <Input
                id="e-date"
                type="date"
                value={date}
                onChange={(ev) => setDate(ev.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteExpenseDialog({
  id,
  onClose,
  onDeleted,
}: {
  id: string | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const remove = useServerFn(deleteExpense);
  const mutation = useMutation({
    mutationFn: async (expenseId: string) => remove({ data: { id: expenseId } }),
    onSuccess: () => {
      toast.success("Despesa excluída");
      onDeleted();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AlertDialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => id && mutation.mutate(id)}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

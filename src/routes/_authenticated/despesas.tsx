import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listExpenses,
  createExpense,
  createRecurringExpense,
  cancelRemainingInstallments,
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
import { Plus, Pencil, Trash2, Receipt, CheckCircle2, CalendarX } from "lucide-react";
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
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [cancelGroupId, setCancelGroupId] = useState<string | null>(null);
  const cancelRemaining = useServerFn(cancelRemainingInstallments);

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

  const cancelGroupMutation = useMutation({
    mutationFn: (id: string) => cancelRemaining({ data: { recurrence_group_id: id } }),
    onSuccess: (r) => {
      toast.success(
        r.cancelled > 0
          ? `${r.cancelled} parcela(s) futura(s) cancelada(s)`
          : "Nenhuma parcela futura pendente para cancelar",
      );
      setCancelGroupId(null);
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["forecast"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visible = groupFilter
    ? expenses.filter((e) => e.recurrence_group_id === groupFilter)
    : expenses;

  const total = visible
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

      {groupFilter && (
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary">Mostrando apenas um grupo de parcelas</Badge>
          <Button variant="link" size="sm" onClick={() => setGroupFilter(null)}>
            Ver todas as despesas
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : visible.length === 0 ? (
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
                  <TableHead className="w-40 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="tabular-nums">{formatDate(e.expense_date)}</TableCell>
                    <TableCell className="font-medium">
                      {e.description}
                      {e.installment_total ? (
                        <button
                          type="button"
                          className="ml-2 align-middle"
                          title="Ver todas as parcelas deste lançamento"
                          onClick={() => setGroupFilter(e.recurrence_group_id)}
                        >
                          <Badge variant="secondary" className="tabular-nums">
                            {e.installment_number}/{e.installment_total}
                          </Badge>
                        </button>
                      ) : null}
                    </TableCell>
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
                      {e.recurrence_group_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Cancelar parcelas restantes"
                          onClick={() => setCancelGroupId(e.recurrence_group_id)}
                        >
                          <CalendarX className="h-4 w-4 text-amber-600" />
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

      <AlertDialog open={!!cancelGroupId} onOpenChange={(o) => !o && setCancelGroupId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar parcelas restantes?</AlertDialogTitle>
            <AlertDialogDescription>
              Apenas as parcelas futuras ainda pendentes serão canceladas. As já pagas permanecem
              intactas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelGroupId && cancelGroupMutation.mutate(cancelGroupId)}
            >
              Cancelar parcelas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



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
  const createRecurring = useServerFn(createRecurringExpense);
  const update = useServerFn(updateExpense);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState<ExpenseStatus | "">("");
  const [mode, setMode] = useState<"unico" | "recorrente" | "parcelado">("unico");
  const [occurrences, setOccurrences] = useState("2");

  useEffect(() => {
    if (open) {
      setDescription(expense?.description ?? "");
      setCategory(expense?.category ?? "");
      setAmount(expense ? String(expense.amount) : "");
      setDate(expense?.expense_date ?? todayISO());
      setStatus(expense?.status ?? "");
      setMode("unico");
      setOccurrences("2");
    }
  }, [open, expense]);

  const autoStatus: ExpenseStatus = date > todayISO() ? "pendente" : "paga";
  const isSeries = !expense && mode !== "unico";
  const n = Math.max(2, parseInt(occurrences) || 2);
  const parsedAmount = parseFloat(amount) || 0;
  const perInstallment =
    mode === "parcelado" ? Math.floor((parsedAmount * 100) / n) / 100 : parsedAmount;

  const mutation = useMutation({
    mutationFn: async () => {
      if (isSeries) {
        return createRecurring({
          data: {
            mode: mode as "recorrente" | "parcelado",
            description,
            category: category || null,
            amount: parsedAmount,
            expense_date: date,
            occurrences: n,
          },
        });
      }
      const payload = {
        description,
        category: category || null,
        amount: parsedAmount,
        expense_date: date,
        status: (status || autoStatus) as ExpenseStatus,
      };
      if (expense) return update({ data: { id: expense.id, ...payload } });
      return create({ data: payload });
    },
    onSuccess: () => {
      toast.success(
        expense ? "Despesa atualizada" : isSeries ? `${n} lançamentos criados` : "Despesa cadastrada",
      );
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
            Despesas não afetam o valor líquido dos atendimentos. Despesas com data futura nascem como
            pendentes.
          </DialogDescription>

        </DialogHeader>
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          {!expense && (
            <div className="space-y-2">
              <Label htmlFor="e-mode">Tipo de lançamento</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                <SelectTrigger id="e-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unico">Único</SelectItem>
                  <SelectItem value="recorrente">Recorrente (mesmo valor por mês)</SelectItem>
                  <SelectItem value="parcelado">Parcelado (valor total dividido)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
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
              <Label htmlFor="e-amount">
                {mode === "parcelado" ? "Valor total *" : mode === "recorrente" ? "Valor por mês *" : "Valor *"}
              </Label>
              <CurrencyInput
                id="e-amount"
                value={parseFloat(amount) || 0}
                onValueChange={(v) => setAmount(String(v))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-date">
                {isSeries ? (mode === "parcelado" ? "Primeira parcela *" : "Primeira ocorrência *") : "Data *"}
              </Label>
              <Input
                id="e-date"
                type="date"
                value={date}
                onChange={(ev) => setDate(ev.target.value)}
                required
              />
            </div>
          </div>
          {isSeries && (
            <div className="space-y-2">
              <Label htmlFor="e-occ">
                {mode === "parcelado" ? "Número de parcelas *" : "Quantidade de meses *"}
              </Label>
              <Input
                id="e-occ"
                type="number"
                min={2}
                max={120}
                value={occurrences}
                onChange={(ev) => setOccurrences(ev.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                {mode === "parcelado"
                  ? `${n}x de aprox. ${brl(perInstallment)} — a última parcela ajusta o arredondamento.`
                  : `${n} lançamentos mensais de ${brl(parsedAmount)}.`}{" "}
                A situação de cada lançamento é definida pela data (futura = pendente).
              </p>
            </div>
          )}
          {!isSeries && (
            <div className="space-y-2">
              <Label htmlFor="e-status">Situação</Label>
              <Select value={status || autoStatus} onValueChange={(v) => setStatus(v as ExpenseStatus)}>
                <SelectTrigger id="e-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["pendente", "paga", "cancelada"] as ExpenseStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Sugerido pela data: {STATUS_LABEL[autoStatus]}
              </p>
            </div>
          )}


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

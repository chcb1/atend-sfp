import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAppointments, deleteAppointment } from "@/lib/appointments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Plus, Pencil, Trash2, Download, ClipboardList, Search } from "lucide-react";
import { toast } from "sonner";
import { brl, formatDateBR } from "@/lib/format";
import { exportAppointmentsToXlsx } from "@/lib/xlsx-export";

export const Route = createFileRoute("/_authenticated/atendimentos/")({
  component: AppointmentsList,
  errorComponent: ({ error }) => <div className="text-destructive">{error.message}</div>,
  notFoundComponent: () => <div>Nada encontrado.</div>,
});

function AppointmentsList() {
  const qc = useQueryClient();
  const list = useServerFn(listAppointments);
  const del = useServerFn(deleteAppointment);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["appointments", { from, to, search }],
    queryFn: () =>
      list({
        data: {
          from: from || undefined,
          to: to || undefined,
          search: search || undefined,
        },
      }),
  });

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          acc.gross += Number(r.gross_value);
          acc.exp += Number(r.expenses);
          acc.tax += Number(r.tax);
          acc.net += Number(r.net_value);
          return acc;
        },
        { gross: 0, exp: 0, tax: 0, net: 0 },
      ),
    [rows],
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Atendimento removido");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Atendimentos</h1>
          <p className="text-sm text-muted-foreground">Registre, edite e exporte seus atendimentos</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              void exportAppointmentsToXlsx(
                rows,
                `atendimentos-${new Date().toISOString().slice(0, 10)}.xlsx`,
              );
            }}
            disabled={rows.length === 0}
          >
            <Download className="mr-2 h-4 w-4" /> Exportar Excel
          </Button>
          <Button asChild>
            <Link to="/atendimentos/novo">
              <Plus className="mr-2 h-4 w-4" /> Novo atendimento
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou procedimento"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="De" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Até" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum atendimento encontrado.</p>
              <Button asChild size="sm" className="mt-2">
                <Link to="/atendimentos/novo">Registrar primeiro atendimento</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Procedimento</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="text-right">Imp./Taxa</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tabular-nums">{formatDateBR(r.date)}</TableCell>
                    <TableCell className="font-medium">{r.client_name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.procedure}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(Number(r.gross_value))}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {brl(Number(r.expenses))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {brl(Number(r.tax))}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {brl(Number(r.net_value))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon">
                        <Link to="/atendimentos/$id/editar" params={{ id: r.id }}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-medium">
                  <TableCell colSpan={3}>Total ({rows.length})</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(totals.gross)}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(totals.exp)}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(totals.tax)}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(totals.net)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover atendimento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAppointments, deleteAppointment } from "@/lib/appointments.functions";
import { updateScheduledAppointment } from "@/lib/schedule.functions";
import type { Appointment, AppointmentStatus } from "@/lib/types";
import { MultiSelect } from "@/components/ui/multi-select";
import { thisMonthRange, lastMonthRange } from "@/lib/date-ranges";
import { statusLabels, statusBadgeClass } from "@/lib/appointment-status";
import { StatusIcon } from "@/components/status-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, Trash2, Download, ClipboardList, Search, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { brl, formatDateBR } from "@/lib/format";
import { exportAppointmentsToXlsx } from "@/lib/xlsx-export";

export const Route = createFileRoute("/_authenticated/atendimentos/")({
  head: () => ({ meta: [
    { title: "Atendimentos — Fisio App" },
    { name: "description", content: "Consulte e gerencie os atendimentos e seus valores no Fisio App." },
    { property: "og:title", content: "Atendimentos — Fisio App" },
    { property: "og:description", content: "Consulte e gerencie os atendimentos e seus valores no Fisio App." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AppointmentsList,
  errorComponent: ({ error }) => <div className="text-destructive">{(error as Error).message}</div>,
  notFoundComponent: () => <div>Nada encontrado.</div>,
});

function AppointmentsList() {
  const qc = useQueryClient();
  const list = useServerFn(listAppointments);
  const del = useServerFn(deleteAppointment);
  const updateSched = useServerFn(updateScheduledAppointment);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  async function reactivate(r: Appointment) {
    if (!r.scheduled_at) return;
    setReactivatingId(r.id);
    try {
      await updateSched({ data: {
        id: r.id,
        client_id: r.client_id,
        client_name: r.client_name,
        procedure_id: r.procedure_id,
        procedure: r.procedure,
        scheduled_at: r.scheduled_at,
        duration_minutes: r.duration_minutes ?? 60,
        gross_value: Number(r.gross_value),
        expenses: Number(r.expenses),
        tax: Number(r.tax),
        notes: r.notes,
        status: "agendado",
      } });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["schedule"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      const undoExpiresAt = Date.now() + 5000;
      toast.success("Atendimento reativado", {
        id: `appointment-status-${r.id}`,
        duration: 5000,
        action: {
          label: "Desfazer",
          onClick: () => {
            if (Date.now() > undoExpiresAt) return;
            void updateSched({ data: {
              id: r.id,
              client_id: r.client_id,
              client_name: r.client_name,
              procedure_id: r.procedure_id,
              procedure: r.procedure,
              scheduled_at: r.scheduled_at!,
              duration_minutes: r.duration_minutes ?? 60,
              gross_value: Number(r.gross_value),
              expenses: Number(r.expenses),
              tax: Number(r.tax),
              notes: r.notes,
              status: "cancelado",
            } }).then(() => {
              qc.invalidateQueries({ queryKey: ["appointments"] });
              qc.invalidateQueries({ queryKey: ["schedule"] });
              qc.invalidateQueries({ queryKey: ["dashboard"] });
              toast.success("Ação desfeita");
            }).catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Não foi possível desfazer"));
          },
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível reativar";
      if (msg.includes("Conflito de horário")) {
        toast.error("Conflito de horário com outro atendimento", {
          description: "Reagende pela agenda para escolher uma nova data e hora.",
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setReactivatingId(null);
    }
  }

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AppointmentStatus[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["appointments", { from, to, search, status }],
    queryFn: () =>
      list({
        data: {
          from: from || undefined,
          to: to || undefined,
          search: search || undefined,
          status_in: status.length ? status : undefined,
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
          <h1 className="text-[30px] font-extrabold tracking-tight">Atendimentos</h1>
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
        <CardContent className="grid gap-3 p-4 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou procedimento"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <MultiSelect
            label="Status"
            options={[
              { value: "agendado", label: "Agendado" },
              { value: "concluido", label: "Concluído" },
              { value: "cancelado", label: "Cancelado" },
            ]}
            value={status}
            onChange={(v) => setStatus(v as AppointmentStatus[])}
          />
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="De" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Até" />
          <div className="flex gap-2 md:col-span-5">
            <Button variant="outline" size="sm" onClick={() => { const r = thisMonthRange(); setFrom(r.from); setTo(r.to); }}>
              Este mês
            </Button>
            <Button variant="outline" size="sm" onClick={() => { const r = lastMonthRange(); setFrom(r.from); setTo(r.to); }}>
              Mês passado
            </Button>
            {(from || to) && (
              <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); }}>Limpar datas</Button>
            )}
          </div>
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
                  <TableHead>Status</TableHead>
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
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "gap-1 whitespace-nowrap",
                          statusBadgeClass[r.status],
                        )}
                      >
                        <StatusIcon status={r.status} />
                        {statusLabels[r.status]}
                      </Badge>
                    </TableCell>
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
                      {r.status === "cancelado" && r.scheduled_at && new Date(r.scheduled_at) > new Date() && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Reativar"
                          aria-label="Reativar"
                          disabled={reactivatingId === r.id}
                          onClick={() => void reactivate(r)}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
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
                  <TableCell colSpan={4}>Total ({rows.length})</TableCell>
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

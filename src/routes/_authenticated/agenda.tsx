import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listSchedule,
  createScheduledAppointment,
  updateScheduledAppointment,
  cancelAppointment,
  completeAppointment,
} from "@/lib/schedule.functions";
import { listClients } from "@/lib/clients.functions";
import { listProcedures } from "@/lib/procedures.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Ban,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { brl } from "@/lib/format";
import type { Appointment, AppointmentStatus } from "@/lib/types";
import { statusStyles, statusLabels } from "@/lib/appointment-status";

export const Route = createFileRoute("/_authenticated/agenda")({
  component: AgendaPage,
  head: () => ({
    meta: [
      { title: "Agenda — Fisio App" },
      {
        name: "description",
        content: "Marque, edite e cancele atendimentos futuros na agenda diária ou semanal.",
      },
      { property: "og:title", content: "Agenda — Fisio App" },
      {
        property: "og:description",
        content: "Marque, edite e cancele atendimentos futuros na agenda diária ou semanal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <div className="text-destructive">{(error as Error).message}</div>,
  notFoundComponent: () => <div>Nada encontrado.</div>,
});

/* ---------- helpers de data (horário local do navegador) ---------- */

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

function startOfWeek(d: Date) {
  const copy = new Date(d);
  const dow = (copy.getDay() + 6) % 7; // segunda = 0
  copy.setDate(copy.getDate() - dow);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

const dayLabel = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});
const longDayLabel = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});
const timeLabel = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });



type ViewMode = "dia" | "semana" | "mes";

const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

type FormState = {
  id: string | null;
  client_id: string;
  procedure_id: string;
  date: string;
  time: string;
  duration_minutes: string;
  gross_value: string;
  expenses: string;
  tax: string;
  notes: string;
  status: AppointmentStatus;
};

function emptyForm(date: string): FormState {
  return {
    id: null,
    client_id: "",
    procedure_id: "",
    date,
    time: "09:00",
    duration_minutes: "60",
    gross_value: "0",
    expenses: "0",
    tax: "0",
    notes: "",
    status: "agendado",
  };
}

function AgendaPage() {
  const qc = useQueryClient();
  const fetchSchedule = useServerFn(listSchedule);
  const fetchClients = useServerFn(listClients);
  const fetchProcedures = useServerFn(listProcedures);
  const create = useServerFn(createScheduledAppointment);
  const update = useServerFn(updateScheduledAppointment);
  const cancel = useServerFn(cancelAppointment);
  const complete = useServerFn(completeAppointment);

  const [view, setView] = useState<ViewMode>("semana");
  const [anchor, setAnchor] = useState(() => toISODate(new Date()));
  const [showCancelled, setShowCancelled] = useState(true);

  const days = useMemo(() => {
    const base = fromISODate(anchor);
    if (view === "dia") return [base];
    if (view === "mes") {
      const first = new Date(base.getFullYear(), base.getMonth(), 1);
      const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      const start = startOfWeek(first);
      const end = addDays(startOfWeek(last), 6);
      const total = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      return Array.from({ length: total }, (_, i) => addDays(start, i));
    }
    const start = startOfWeek(base);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor, view]);


  const rangeFrom = useMemo(() => {
    const d = new Date(days[0]!);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [days]);
  const rangeTo = useMemo(() => {
    const d = addDays(days[days.length - 1]!, 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [days]);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["schedule", rangeFrom, rangeTo],
    queryFn: () => fetchSchedule({ data: { from: rangeFrom, to: rangeTo } }),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchClients(),
  });
  const { data: procedures = [] } = useQuery({
    queryKey: ["procedures"],
    queryFn: () => fetchProcedures(),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm(toISODate(new Date())));
  const [formError, setFormError] = useState<string | null>(null);
  const pendingActions = useRef(new Set<string>());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  function openNew(date?: Date) {
    setFormError(null);
    setForm(emptyForm(toISODate(date ?? fromISODate(anchor))));
    setOpen(true);
  }

  function openEdit(a: Appointment) {
    setFormError(null);
    const when = a.scheduled_at ? new Date(a.scheduled_at) : new Date();
    setForm({
      id: a.id,
      client_id: a.client_id ?? "",
      procedure_id: a.procedure_id ?? "",
      date: toISODate(when),
      time: `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`,
      duration_minutes: String(a.duration_minutes ?? 60),
      gross_value: String(a.gross_value ?? 0),
      expenses: String(a.expenses ?? 0),
      tax: String(a.tax ?? 0),
      notes: a.notes ?? "",
      status: a.status,
    });
    setOpen(true);
  }

  const saving = useMutation({
    mutationFn: async (payload: FormState) => {
      const client = clients.find((c) => c.id === payload.client_id);
      const procedure = procedures.find((p) => p.id === payload.procedure_id);
      if (!client) throw new Error("Selecione um cliente");
      if (!procedure) throw new Error("Selecione um procedimento");
      const scheduled = new Date(`${payload.date}T${payload.time}:00`);
      if (Number.isNaN(scheduled.getTime())) throw new Error("Data/hora inválida");

      const body = {
        client_id: client.id,
        client_name: client.name,
        procedure_id: procedure.id,
        procedure: procedure.name,
        scheduled_at: scheduled.toISOString(),
        duration_minutes: Number(payload.duration_minutes) || 60,
        gross_value: Number(payload.gross_value) || 0,
        expenses: Number(payload.expenses) || 0,
        tax: Number(payload.tax) || 0,
        notes: payload.notes.trim() || null,
        status: payload.status,
      };
      return payload.id
        ? update({ data: { ...body, id: payload.id } })
        : create({ data: body });
    },
    onSuccess: () => {
      toast.success(form.id ? "Agendamento atualizado" : "Horário marcado");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["schedule"] });
      void qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : "Não foi possível salvar");
    },
  });

  function refreshStatuses() {
    for (const key of ["schedule", "appointments", "dashboard", "forecast"]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  }

  function setActionBusy(id: string, busy: boolean) {
    if (busy) pendingActions.current.add(id);
    else pendingActions.current.delete(id);
    setBusyIds(new Set(pendingActions.current));
  }

  async function restoreStatus(previous: Appointment) {
    if (pendingActions.current.has(previous.id) || !previous.scheduled_at) return;
    setActionBusy(previous.id, true);
    try {
      await update({ data: {
        id: previous.id,
        client_id: previous.client_id,
        client_name: previous.client_name,
        procedure_id: previous.procedure_id,
        procedure: previous.procedure,
        scheduled_at: previous.scheduled_at,
        duration_minutes: previous.duration_minutes ?? 60,
        gross_value: Number(previous.gross_value),
        expenses: Number(previous.expenses),
        tax: Number(previous.tax),
        notes: previous.notes,
        status: previous.status,
      } });
      refreshStatuses();
      toast.success("Ação desfeita");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível desfazer");
    } finally {
      setActionBusy(previous.id, false);
    }
  }

  async function changeStatus(previous: Appointment, next: "concluido" | "cancelado") {
    if (pendingActions.current.has(previous.id)) return;
    setActionBusy(previous.id, true);
    try {
      await (next === "concluido" ? complete : cancel)({ data: { id: previous.id } });
      refreshStatuses();
      const undoExpiresAt = Date.now() + 5000;
      toast.success(next === "concluido" ? "Atendimento concluído" : "Agendamento cancelado", {
        id: `appointment-status-${previous.id}`,
        duration: 5000,
        action: {
          label: "Desfazer",
          onClick: () => {
            if (Date.now() <= undoExpiresAt) void restoreStatus(previous);
          },
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível alterar o status");
    } finally {
      setActionBusy(previous.id, false);
    }
  }

  const visible = showCancelled
    ? appointments
    : appointments.filter((a) => a.status !== "cancelado");

  function byDay(day: Date) {
    const key = toISODate(day);
    return visible
      .filter((a) => a.scheduled_at && toISODate(new Date(a.scheduled_at)) === key)
      .sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1));
  }

  function shift(delta: number) {
    const base = fromISODate(anchor);
    if (view === "mes") {
      setAnchor(toISODate(new Date(base.getFullYear(), base.getMonth() + delta, 1)));
      return;
    }
    setAnchor(toISODate(addDays(base, view === "dia" ? delta : delta * 7)));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <CalendarDays className="h-6 w-6 text-primary" />
            Agenda
          </h1>
          <p className="text-sm text-muted-foreground">
            {view === "dia"
              ? longDayLabel.format(days[0]!)
              : view === "mes"
                ? monthLabel.format(fromISODate(anchor))
                : `${dayLabel.format(days[0]!)} — ${dayLabel.format(days[days.length - 1]!)}`}
          </p>
        </div>
        <Button onClick={() => openNew()}>
          <Plus className="mr-2 h-4 w-4" />
          Marcar horário
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="dia">Dia</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mês</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(toISODate(new Date()))}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Próximo">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant={showCancelled ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowCancelled((s) => !s)}
        >
          {showCancelled ? "Ocultar cancelados" : "Mostrar cancelados"}
        </Button>
      </div>

      {view === "mes" ? (
        <div className="grid grid-cols-7 gap-1">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((w) => (
            <div key={w} className="pb-1 text-center text-xs font-medium text-muted-foreground">
              {w}
            </div>
          ))}
          {days.map((day) => {
            const items = byDay(day);
            const key = toISODate(day);
            const isToday = key === toISODate(new Date());
            const inMonth = day.getMonth() === fromISODate(anchor).getMonth();
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setAnchor(key);
                  setView("dia");
                }}
                className={cn(
                  "min-h-24 rounded-md border p-1 text-left align-top transition-colors hover:bg-accent/50",
                  !inMonth && "opacity-45",
                  isToday && "ring-1 ring-primary",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{day.getDate()}</span>
                  {items.length === 0 && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Marcar neste dia"
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        openNew(day);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          openNew(day);
                        }
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-0.5">
                  {items.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[10px]",
                        statusStyles[a.status],
                        a.status === "cancelado" && "line-through",
                      )}
                    >
                      {timeLabel.format(new Date(a.scheduled_at!))} {a.client_name}
                    </div>
                  ))}
                  {items.length > 3 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{items.length - 3}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
      <div
        className={cn(
          "grid gap-3",
          view === "dia" ? "grid-cols-1" : "grid-cols-1 md:grid-cols-7",
        )}
      >
        {days.map((day) => {
          const items = byDay(day);
          const isToday = toISODate(day) === toISODate(new Date());
          return (
            <Card key={toISODate(day)} className={cn(isToday && "ring-1 ring-primary")}>
              <CardContent className="space-y-2 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">
                    {view === "dia" ? longDayLabel.format(day) : dayLabel.format(day)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => openNew(day)}
                    aria-label="Marcar neste dia"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {isLoading ? (
                  <p className="text-xs text-muted-foreground">Carregando…</p>
                ) : items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem atendimentos</p>
                ) : (
                  items.map((a) => (
                    <div
                      key={a.id}
                      className={cn("rounded-md p-2 text-xs", statusStyles[a.status])}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {timeLabel.format(new Date(a.scheduled_at!))} · {a.duration_minutes}min
                        </span>
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {statusLabels[a.status]}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "truncate font-medium",
                          a.status === "cancelado" && "line-through",
                        )}
                      >
                        {a.client_name}
                      </p>
                      <p className="truncate text-muted-foreground">{a.procedure}</p>
                      <p className="text-muted-foreground">{brl(Number(a.gross_value))}</p>
                      {a.status !== "cancelado" && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 shrink-0"
                            disabled={busyIds.has(a.id)}
                            title="Editar"
                            onClick={() => openEdit(a)}
                            aria-label="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {a.status === "agendado" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 shrink-0"
                              disabled={busyIds.has(a.id)}
                              title="Concluir"
                              onClick={() => void changeStatus(a, "concluido")}
                              aria-label="Concluir"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {a.status === "agendado" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 shrink-0"
                              disabled={busyIds.has(a.id)}
                              title="Cancelar"
                              onClick={() => void changeStatus(a, "cancelado")}
                              aria-label="Cancelar"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar agendamento" : "Marcar horário"}</DialogTitle>
            <DialogDescription>
              Selecione cliente, procedimento e o horário do atendimento.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFormError(null);
              saving.mutate(form);
            }}
          >
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select
                value={form.client_id}
                onValueChange={(v) => setForm((f) => ({ ...f, client_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Procedimento</Label>
              <Select
                value={form.procedure_id}
                onValueChange={(v) => {
                  const p = procedures.find((x) => x.id === v);
                  setForm((f) => ({
                    ...f,
                    procedure_id: v,
                    gross_value: p ? String(p.default_value) : f.gross_value,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o procedimento" />
                </SelectTrigger>
                <SelectContent>
                  {procedures.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {brl(Number(p.default_value))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O valor bruto é preenchido pelo procedimento e pode ser editado.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ag-date">Data</Label>
                <Input
                  id="ag-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ag-time">Hora</Label>
                <Input
                  id="ag-time"
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ag-dur">Duração (min)</Label>
                <Input
                  id="ag-dur"
                  type="number"
                  min={5}
                  step={5}
                  value={form.duration_minutes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, duration_minutes: e.target.value }))
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ag-gross">Valor bruto</Label>
                <CurrencyInput
                  id="ag-gross"
                  value={parseFloat(form.gross_value) || 0}
                  onValueChange={(v) => setForm((f) => ({ ...f, gross_value: String(v) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ag-exp">Despesas</Label>
                <CurrencyInput
                  id="ag-exp"
                  value={parseFloat(form.expenses) || 0}
                  onValueChange={(v) => setForm((f) => ({ ...f, expenses: String(v) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ag-tax">Imposto/Taxa</Label>
                <CurrencyInput
                  id="ag-tax"
                  value={parseFloat(form.tax) || 0}
                  onValueChange={(v) => setForm((f) => ({ ...f, tax: String(v) }))}
                />
              </div>
            </div>

            {form.id && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, status: v as AppointmentStatus }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agendado">Agendado</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="ag-notes">Observações</Label>
              <Textarea
                id="ag-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving.isPending}>
                {saving.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

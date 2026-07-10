import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { listClients } from "@/lib/clients.functions";
import { listProcedures } from "@/lib/procedures.functions";
import { createAppointment, updateAppointment } from "@/lib/appointments.functions";
import { ClientForm } from "@/routes/_authenticated/clientes";
import { ProcedureForm } from "@/routes/_authenticated/procedimentos";
import type { Appointment } from "@/lib/types";
import { brl, todayIso } from "@/lib/format";

export function AppointmentForm({ appointment }: { appointment?: Appointment }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const list = useServerFn(listClients);
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => list(),
  });
  const listProcs = useServerFn(listProcedures);
  const { data: procedures = [] } = useQuery({
    queryKey: ["procedures"],
    queryFn: () => listProcs(),
  });

  const [date, setDate] = useState(appointment?.date ?? todayIso());
  const [clientId, setClientId] = useState<string>(appointment?.client_id ?? "");
  const [clientName, setClientName] = useState(appointment?.client_name ?? "");
  const [procedureId, setProcedureId] = useState<string>(appointment?.procedure_id ?? "");
  const [procedure, setProcedure] = useState(appointment?.procedure ?? "");
  const [grossValue, setGrossValue] = useState<string>(
    appointment ? String(appointment.gross_value) : "",
  );
  const [expenses, setExpenses] = useState<string>(
    appointment ? String(appointment.expenses) : "0",
  );
  const [tax, setTax] = useState<string>(appointment ? String(appointment.tax) : "0");
  const [notes, setNotes] = useState(appointment?.notes ?? "");

  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newProcedureOpen, setNewProcedureOpen] = useState(false);

  const netValue = useMemo(() => {
    const g = parseFloat(grossValue) || 0;
    const e = parseFloat(expenses) || 0;
    const t = parseFloat(tax) || 0;
    return g - e - t;
  }, [grossValue, expenses, tax]);

  useEffect(() => {
    if (clientId) {
      const c = clients.find((x) => x.id === clientId);
      if (c) setClientName(c.name);
    }
  }, [clientId, clients]);

  const create = useServerFn(createAppointment);
  const update = useServerFn(updateAppointment);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        date,
        client_id: clientId || null,
        client_name: clientName.trim(),
        procedure_id: procedureId || null,
        procedure: procedure.trim(),
        gross_value: parseFloat(grossValue) || 0,
        expenses: parseFloat(expenses) || 0,
        tax: parseFloat(tax) || 0,
        notes: notes || null,
      };
      if (appointment) return update({ data: { id: appointment.id, ...payload } });
      return create({ data: payload });
    },
    onSuccess: () => {
      toast.success(appointment ? "Atendimento atualizado" : "Atendimento registrado");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      navigate({ to: "/atendimentos" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSelectProcedure(id: string) {
    setProcedureId(id);
    const p = procedures.find((x) => x.id === id);
    if (p) {
      setProcedure(p.name);
      // Sempre sugere o valor padrão; o usuário pode editar caso seja diferente.
      setGrossValue(String(p.default_value));
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{appointment ? "Editar atendimento" : "Novo atendimento"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!clientName.trim()) {
                toast.error("Selecione ou informe o cliente");
                return;
              }
              if (!procedure.trim()) {
                toast.error("Selecione ou informe o procedimento");
                return;
              }
              mutation.mutate();
            }}
            className="space-y-6"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Data *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client">Cliente *</Label>
                <div className="flex gap-2">
                  <Select value={clientId || "__none"} onValueChange={(v) => setClientId(v === "__none" ? "" : v)}>
                    <SelectTrigger id="client" className="flex-1">
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Cliente avulso —</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setNewClientOpen(true)}
                    title="Novo cliente"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {!clientId && (
                  <Input
                    placeholder="Nome do cliente avulso"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="procedure">Procedimento *</Label>
              <div className="flex gap-2">
                <Select
                  value={procedureId || "__none"}
                  onValueChange={(v) => {
                    if (v === "__none") {
                      setProcedureId("");
                    } else {
                      onSelectProcedure(v);
                    }
                  }}
                >
                  <SelectTrigger id="procedure" className="flex-1">
                    <SelectValue placeholder="Selecione um procedimento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Procedimento avulso —</SelectItem>
                    {procedures.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {brl(Number(p.default_value))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setNewProcedureOpen(true)}
                  title="Novo procedimento"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {!procedureId && (
                <Input
                  placeholder="Nome do procedimento avulso"
                  value={procedure}
                  onChange={(e) => setProcedure(e.target.value)}
                />
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="gross">Valor Bruto *</Label>
                <Input
                  id="gross"
                  type="number"
                  step="0.01"
                  min="0"
                  value={grossValue}
                  onChange={(e) => setGrossValue(e.target.value)}
                  required
                />
                {procedureId && (
                  <p className="text-xs text-muted-foreground">
                    Sugerido pelo procedimento — edite se o valor for diferente.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp">Despesas</Label>
                <Input
                  id="exp"
                  type="number"
                  step="0.01"
                  min="0"
                  value={expenses}
                  onChange={(e) => setExpenses(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax">Imposto / Taxa</Label>
                <Input
                  id="tax"
                  type="number"
                  step="0.01"
                  min="0"
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Valor Líquido (calculado)
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{brl(netValue)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Valor Bruto − Despesas − Imposto/Taxa
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: "/atendimentos" })}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                Salvar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <ClientForm
        open={newClientOpen}
        onOpenChange={setNewClientOpen}
        client={null}
        onSaved={(c) => {
          qc.invalidateQueries({ queryKey: ["clients"] });
          setClientId(c.id);
          setClientName(c.name);
        }}
      />

      <ProcedureForm
        open={newProcedureOpen}
        onOpenChange={setNewProcedureOpen}
        procedure={null}
        onSaved={(p) => {
          qc.invalidateQueries({ queryKey: ["procedures"] });
          setProcedureId(p.id);
          setProcedure(p.name);
          setGrossValue(String(p.default_value));
        }}
      />
    </>
  );
}

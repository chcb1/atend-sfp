import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listProcedures,
  createProcedure,
  updateProcedure,
  deleteProcedure,
} from "@/lib/procedures.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Pencil, Trash2, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import type { Procedure } from "@/lib/types";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/procedimentos")({
  head: () => ({ meta: [
    { title: "Procedimentos — Fisio App" },
    { name: "description", content: "Gerencie procedimentos e valores de atendimento no Fisio App." },
    { property: "og:title", content: "Procedimentos — Fisio App" },
    { property: "og:description", content: "Gerencie procedimentos e valores de atendimento no Fisio App." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ProceduresPage,
  errorComponent: ({ error }) => <div className="text-destructive">{(error as Error).message}</div>,
  notFoundComponent: () => <div>Nada encontrado.</div>,
});

function ProceduresPage() {
  const qc = useQueryClient();
  const list = useServerFn(listProcedures);
  const { data: procedures = [], isLoading } = useQuery({
    queryKey: ["procedures"],
    queryFn: () => list(),
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Procedure | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Procedimentos</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre procedimentos com valor padrão para agilizar o registro de atendimentos
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setEditOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Novo procedimento
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : procedures.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <Stethoscope className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum procedimento cadastrado ainda.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor padrão</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {procedures.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.description || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(Number(p.default_value))}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(p);
                          setEditOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ProcedureForm
        open={editOpen}
        onOpenChange={setEditOpen}
        procedure={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["procedures"] })}
      />

      <DeleteProcedureDialog
        id={deleteId}
        onClose={() => setDeleteId(null)}
        onDeleted={() => qc.invalidateQueries({ queryKey: ["procedures"] })}
      />
    </div>
  );
}

export function ProcedureForm({
  open,
  onOpenChange,
  procedure,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  procedure: Procedure | null;
  onSaved?: (p: Procedure) => void;
}) {
  const create = useServerFn(createProcedure);
  const update = useServerFn(updateProcedure);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultValue, setDefaultValue] = useState("0");

  useEffect(() => {
    if (open) {
      setName(procedure?.name ?? "");
      setDescription(procedure?.description ?? "");
      setDefaultValue(procedure ? String(procedure.default_value) : "0");
    }
  }, [open, procedure]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description: description || null,
        default_value: parseFloat(defaultValue) || 0,
      };
      if (procedure) return update({ data: { id: procedure.id, ...payload } });
      return create({ data: payload });
    },
    onSuccess: (row) => {
      toast.success(procedure ? "Procedimento atualizado" : "Procedimento cadastrado");
      onSaved?.(row);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{procedure ? "Editar procedimento" : "Novo procedimento"}</DialogTitle>
          <DialogDescription>
            O valor padrão é sugerido automaticamente ao selecionar o procedimento em um novo atendimento.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="p-name">Atendimento / Nome *</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-desc">Descrição</Label>
            <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-value">Valor padrão *</Label>
            <Input
              id="p-value"
              type="number"
              step="0.01"
              min="0"
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProcedureDialog({
  id,
  onClose,
  onDeleted,
}: {
  id: string | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const del = useServerFn(deleteProcedure);
  const mutation = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Procedimento removido");
      onDeleted();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <AlertDialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover procedimento?</AlertDialogTitle>
          <AlertDialogDescription>
            Atendimentos existentes preservarão o nome do procedimento.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => id && mutation.mutate(id)}>
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAuditLogs, type AuditLog } from "@/lib/audit.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollText, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/auditoria")({
  component: AuditPage,
  errorComponent: ({ error }) => <div className="text-destructive">{error.message}</div>,
  notFoundComponent: () => <div>Nada encontrado.</div>,
});

const ENTITY_LABEL: Record<string, string> = {
  appointments: "Atendimento",
  clients: "Cliente",
  procedures: "Procedimento",
  user_roles: "Papel de usuário",
};

const ACTION_LABEL: Record<string, string> = {
  INSERT: "Criação",
  UPDATE: "Alteração",
  DELETE: "Exclusão",
};

function actionVariant(a: string): "default" | "secondary" | "destructive" {
  if (a === "INSERT") return "default";
  if (a === "UPDATE") return "secondary";
  return "destructive";
}

function AuditPage() {
  const list = useServerFn(listAuditLogs);
  const [entity, setEntity] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin", "audit", entity, action, email],
    queryFn: () =>
      list({
        data: {
          entity: entity === "all" ? undefined : entity,
          action: action === "all" ? undefined : (action as any),
          user_email: email || undefined,
          limit: 200,
        },
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
          <ScrollText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Auditoria</h1>
          <p className="text-sm text-muted-foreground">
            Histórico de criações, alterações e exclusões.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Entidade</Label>
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="appointments">Atendimentos</SelectItem>
                <SelectItem value="clients">Clientes</SelectItem>
                <SelectItem value="procedures">Procedimentos</SelectItem>
                <SelectItem value="user_roles">Papéis</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Ação</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="INSERT">Criação</SelectItem>
                <SelectItem value="UPDATE">Alteração</SelectItem>
                <SelectItem value="DELETE">Exclusão</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Usuário (email)</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="filtrar por email"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>ID do registro</TableHead>
                <TableHead className="text-right">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum registro.
                  </TableCell>
                </TableRow>
              )}
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>{l.user_email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={actionVariant(l.action)}>
                      {ACTION_LABEL[l.action]}
                    </Badge>
                  </TableCell>
                  <TableCell>{ENTITY_LABEL[l.entity] ?? l.entity}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {l.entity_id?.slice(0, 8) ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(l)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da alteração</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <div><strong>Usuário:</strong> {selected.user_email ?? "—"}</div>
              <div><strong>Ação:</strong> {ACTION_LABEL[selected.action]}</div>
              <div><strong>Entidade:</strong> {ENTITY_LABEL[selected.entity] ?? selected.entity}</div>
              <div><strong>Registro:</strong> <code>{selected.entity_id}</code></div>
              <div><strong>Data:</strong> {new Date(selected.created_at).toLocaleString("pt-BR")}</div>
              <div>
                <strong>Dados:</strong>
                <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(selected.changes, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

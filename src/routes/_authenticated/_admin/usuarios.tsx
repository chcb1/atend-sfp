import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listUsers,
  grantRole,
  revokeRole,
  deleteUser,
  setUserStatus,
  type AdminUser,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Shield, ShieldOff, Trash2, Users, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/_admin/usuarios")({
  component: UsersAdmin,
  errorComponent: ({ error }) => <div className="text-destructive">{error.message}</div>,
  notFoundComponent: () => <div>Nada encontrado.</div>,
});

function UsersAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(listUsers);
  const grant = useServerFn(grantRole);
  const revoke = useServerFn(revokeRole);
  const del = useServerFn(deleteUser);
  const setStatus = useServerFn(setUserStatus);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => list(),
  });

  const [toDelete, setToDelete] = useState<AdminUser | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });

  const grantMut = useMutation({
    mutationFn: (v: { user_id: string; role: "admin" | "user" }) => grant({ data: v }),
    onSuccess: () => { invalidate(); toast.success("Papel concedido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: (v: { user_id: string; role: "admin" | "user" }) => revoke({ data: v }),
    onSuccess: () => { invalidate(); toast.success("Papel removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (user_id: string) => del({ data: { user_id } }),
    onSuccess: () => { invalidate(); toast.success("Usuário excluído"); setToDelete(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (v: { user_id: string; status: "pending" | "approved" | "rejected" }) =>
      setStatus({ data: v }),
    onSuccess: (_r, v) => {
      invalidate();
      toast.success(
        v.status === "approved" ? "Usuário aprovado" : v.status === "rejected" ? "Usuário rejeitado" : "Status atualizado",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = users.filter((u) => u.status === "pending" && !u.roles.includes("admin"));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie contas e permissões de administrador.
          </p>
        </div>
      </div>

      {pending.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4 text-amber-600" />
              Aguardando aprovação ({pending.length})
            </div>
            <div className="space-y-2">
              {pending.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-3"
                >
                  <div>
                    <div className="font-medium">{u.email ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      Cadastrado em {formatDateBR(u.created_at.slice(0, 10))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        statusMut.mutate({ user_id: u.id, status: "approved" })
                      }
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        statusMut.mutate({ user_id: u.id, status: "rejected" })
                      }
                    >
                      <X className="mr-1 h-4 w-4" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Papéis</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
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
              {!isLoading && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum usuário.
                  </TableCell>
                </TableRow>
              )}
              {users.map((u) => {
                const isAdmin = u.roles.includes("admin");
                const statusVariant =
                  u.status === "approved"
                    ? "default"
                    : u.status === "rejected"
                      ? "destructive"
                      : "secondary";
                const statusLabel =
                  u.status === "approved"
                    ? "aprovado"
                    : u.status === "rejected"
                      ? "rejeitado"
                      : "pendente";
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant as any}>
                        {isAdmin ? "aprovado" : statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 && (
                          <Badge variant="outline">sem papel</Badge>
                        )}
                        {u.roles.map((r) => (
                          <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{formatDateBR(u.created_at.slice(0, 10))}</TableCell>
                    <TableCell>
                      {u.last_sign_in_at
                        ? formatDateBR(u.last_sign_in_at.slice(0, 10))
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {!isAdmin && u.status !== "approved" && (
                          <Button
                            size="sm"
                            onClick={() =>
                              statusMut.mutate({ user_id: u.id, status: "approved" })
                            }
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Aprovar
                          </Button>
                        )}
                        {!isAdmin && u.status === "approved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              statusMut.mutate({ user_id: u.id, status: "rejected" })
                            }
                          >
                            <X className="mr-1 h-4 w-4" />
                            Rejeitar
                          </Button>
                        )}
                        {isAdmin ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              revokeMut.mutate({ user_id: u.id, role: "admin" })
                            }
                          >
                            <ShieldOff className="mr-1 h-4 w-4" />
                            Remover admin
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              grantMut.mutate({ user_id: u.id, role: "admin" })
                            }
                          >
                            <Shield className="mr-1 h-4 w-4" />
                            Tornar admin
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setToDelete(u)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>


      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.email} será removido permanentemente. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && delMut.mutate(toDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

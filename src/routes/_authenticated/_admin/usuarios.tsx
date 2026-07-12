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
import { Shield, ShieldOff, Trash2, Users } from "lucide-react";
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

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => list(),
  });

  const [toDelete, setToDelete] = useState<AdminUser | null>(null);

  const grantMut = useMutation({
    mutationFn: (v: { user_id: string; role: "admin" | "user" }) => grant({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Papel concedido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: (v: { user_id: string; role: "admin" | "user" }) => revoke({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Papel removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (user_id: string) => del({ data: { user_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Usuário excluído");
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Papéis</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum usuário.
                  </TableCell>
                </TableRow>
              )}
              {users.map((u) => {
                const isAdmin = u.roles.includes("admin");
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email ?? "—"}</TableCell>
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
                      <div className="flex justify-end gap-2">
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

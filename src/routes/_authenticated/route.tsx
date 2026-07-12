import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { getMyApprovalStatus } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, ShieldAlert, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const getStatus = useServerFn(getMyApprovalStatus);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["me", "approval"],
    queryFn: () => getStatus(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/30 text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (isError || !data) {
    return <PendingScreen status="pending" />;
  }

  if (!data.isAdmin && data.status !== "approved") {
    return <PendingScreen status={data.status} />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function PendingScreen({ status }: { status: "pending" | "rejected" }) {
  const router = useRouter();
  const qc = useQueryClient();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  const rejected = status === "rejected";

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 p-4">
      <Card className="max-w-md">
        <CardHeader className="items-center text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            {rejected ? <ShieldAlert className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
          </div>
          <CardTitle className="mt-2">
            {rejected ? "Acesso negado" : "Conta aguardando aprovação"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
          <p>
            {rejected
              ? "Seu cadastro foi rejeitado por um administrador. Entre em contato com o responsável se acredita que isso é um erro."
              : "Sua conta foi criada com sucesso, mas ainda precisa ser aprovada por um administrador antes de acessar o sistema."}
          </p>
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

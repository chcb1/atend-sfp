import type { ReactNode } from "react";
import { Link, useRouter, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  LogOut,
  Wallet,
  Stethoscope,
  Shield,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { isCurrentUserAdmin } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

const baseNav = [
  { to: "/atendimentos", label: "Atendimentos", icon: ClipboardList },
  { to: "/procedimentos", label: "Procedimentos", icon: Stethoscope },
  { to: "/clientes", label: "Clientes", icon: Users },
] as const;

const dashboardNav = { to: "/", label: "Dashboard", icon: LayoutDashboard } as const;

const adminNav = [
  { to: "/usuarios", label: "Usuários", icon: Shield },
  { to: "/auditoria", label: "Auditoria", icon: ScrollText },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const location = useLocation();
  const qc = useQueryClient();
  const checkAdmin = useServerFn(isCurrentUserAdmin);
  const { data: isAdmin = false } = useQuery({
    queryKey: ["me", "isAdmin"],
    queryFn: () => checkAdmin(),
    staleTime: 60_000,
  });

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  const items = [...(isAdmin ? [dashboardNav] : []), ...baseNav, ...(isAdmin ? adminNav : [])];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Wallet className="h-4 w-4" />
            </div>
            <span>Fisio App</span>
          </Link>
          <nav className="flex items-center gap-1">
            {items.map((item) => {
              const active =
                item.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Link, useRouter, useLocation } from "@tanstack/react-router";
import {
  CalendarDays,
  LayoutDashboard,
  ClipboardList,
  Users,
  LogOut,
  Activity,
  MoreHorizontal,
  Stethoscope,
  Shield,
  ScrollText,
  Clock,
  Receipt,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { isCurrentUserAdmin } from "@/lib/admin.functions";
import { logSessionEvent } from "@/lib/session-audit.functions";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSessionEmail } from "@/components/session-context";
import { clearSessionActivity } from "@/lib/session-activity";

const baseNav = [
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/atendimentos", label: "Atendimentos", icon: ClipboardList },
  { to: "/procedimentos", label: "Procedimentos", icon: Stethoscope },
  { to: "/clientes", label: "Clientes", icon: Users },
] as const;

const dashboardNav = { to: "/", label: "Dashboard", icon: LayoutDashboard } as const;

const adminNav = [
  { to: "/despesas", label: "Despesas", icon: Receipt },
  { to: "/usuarios", label: "Usuários", icon: Shield },
  { to: "/auditoria", label: "Auditoria", icon: ScrollText },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const location = useLocation();
  const qc = useQueryClient();
  const checkAdmin = useServerFn(isCurrentUserAdmin);
  const logSession = useServerFn(logSessionEvent);
  const userEmail = useSessionEmail();
  const [showWarning, setShowWarning] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const signingOut = useRef(false);

  const { data: isAdmin = false } = useQuery({
    queryKey: ["me", "isAdmin"],
    queryFn: () => checkAdmin(),
    staleTime: 60_000,
  });

  const doSignOut = useCallback(
    async (reason?: string) => {
      if (signingOut.current) return;
      signingOut.current = true;
      try {
        await logSession({ data: { action: "LOGOUT", ...(reason ? { reason } : {}) } });
      } catch {
        // não bloqueia o logout se o registro falhar
      }
      await qc.cancelQueries();
      qc.clear();
      clearSessionActivity();
      await supabase.auth.signOut();
      router.navigate({ to: "/auth", replace: true });
    },
    [logSession, qc, router],
  );

  const { resetActivity } = useIdleTimeout({
    timeoutMs: 10 * 60 * 1000,
    warningMs: 60 * 1000,
    onWarn: () => setShowWarning(true),
    onTimeout: (reason) => {
      setShowWarning(false);
      void doSignOut(reason ?? "Sessão encerrada por inatividade (10 minutos)");
    },
  });

  function stayConnected() {
    setShowWarning(false);
    resetActivity(true);
  }

  const items = [...(isAdmin ? [dashboardNav] : []), ...baseNav, ...(isAdmin ? adminNav : [])];
  const accountItems = items.filter((item) => item.to === "/usuarios" || item.to === "/auditoria");
  const operationalItems = items.filter((item) => !accountItems.some((account) => account.to === item.to));
  const mobileItems = [baseNav[0], baseNav[1], baseNav[3]];
  const moreItems = items.filter((item) => !mobileItems.some((mobile) => mobile.to === item.to));
  const isActive = (to: string) => to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 xl:gap-6">
          <Link to="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Activity className="h-4 w-4" />
            </div>
            <span>Fisio App</span>
          </Link>
          <nav aria-label="Navegação principal" className="hidden min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex xl:gap-1">
            {operationalItems.map((item) => {
              const active =
                item.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={item.label}
                  aria-label={item.label}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-2 text-sm font-medium transition-colors xl:gap-2 xl:px-3",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto hidden shrink-0 items-center md:flex">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" title="Menu da conta" aria-label="Menu da conta" className={cn(accountItems.some((item) => isActive(item.to)) && "bg-accent text-accent-foreground")}>
                  <UserRound className="h-4 w-4 shrink-0" />
                  <span className="hidden max-w-32 truncate xl:inline">{userEmail?.split("@")[0]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
                <DropdownMenuLabel className="break-all font-normal">{userEmail}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {accountItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.to} asChild className={cn(isActive(item.to) && "bg-accent text-accent-foreground")}>
                      <Link to={item.to} aria-current={isActive(item.to) ? "page" : undefined}>
                        <Icon />{item.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
                {accountItems.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem onSelect={() => void doSignOut()}><LogOut />Sair</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">{children}</main>

      <nav aria-label="Navegação móvel" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-background px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          return (
            <Button key={item.to} asChild variant="ghost" className={cn("h-14 min-w-0 flex-col gap-1 px-1 text-xs", isActive(item.to) ? "bg-accent text-accent-foreground" : "text-muted-foreground")}>
              <Link to={item.to} aria-current={isActive(item.to) ? "page" : undefined}>
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            </Button>
          );
        })}
        <Popover open={moreOpen} onOpenChange={setMoreOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" className={cn("h-14 min-w-0 flex-col gap-1 px-1 text-xs", moreOpen || moreItems.some((item) => isActive(item.to)) ? "bg-accent text-accent-foreground" : "text-muted-foreground")}>
              <MoreHorizontal className="h-5 w-5" />
              Mais
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="max-h-[70dvh] w-64 overflow-y-auto p-2 md:hidden" aria-label="Mais opções">
            {moreItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button key={item.to} asChild variant="ghost" className={cn("h-11 w-full justify-start", isActive(item.to) && "bg-accent text-accent-foreground")}>
                  <Link to={item.to} onClick={() => setMoreOpen(false)} aria-current={isActive(item.to) ? "page" : undefined}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
            <div className="mt-2 border-t pt-2">
              <Button variant="ghost" className="h-11 w-full justify-start" onClick={() => { setMoreOpen(false); void doSignOut(); }}>
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </nav>

      <Dialog open={showWarning} onOpenChange={(o) => !o && stayConnected()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Sessão prestes a expirar
            </DialogTitle>
            <DialogDescription>
              Sua sessão vai expirar em 1 minuto por inatividade.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => void doSignOut()}>
              Sair agora
            </Button>
            <Button onClick={stayConnected}>Continuar conectado</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

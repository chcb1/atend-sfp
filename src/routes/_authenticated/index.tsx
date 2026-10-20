import { useMemo, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";
import { getDashboardStats, getForecastStats } from "@/lib/dashboard.functions";
import { isCurrentUserAdmin } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, formatDateBR } from "@/lib/format";
import {
  Plus,
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  CalendarClock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [
    { title: "Dashboard — Fisio App" },
    { name: "description", content: "Indicadores realizados, provisão futura e resultado de caixa do Fisio App." },
    { property: "og:title", content: "Dashboard — Fisio App" },
    { property: "og:description", content: "Indicadores realizados, provisão futura e resultado de caixa do Fisio App." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Dashboard,
  errorComponent: ({ error }) => <div className="text-destructive">{(error as Error).message}</div>,
  notFoundComponent: () => <div>Nada encontrado.</div>,
});

type Range = "month" | "three-months" | "year" | "all";

function rangeToDates(r: Range): { from?: string; to?: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (r === "month") return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
  if (r === "three-months") return { from: iso(new Date(y, m - 2, 1)), to: iso(new Date(y, m + 1, 0)) };
  if (r === "year") return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) };
  return {};
}

const PIE_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9", "#f97316"];

function Dashboard() {
  const checkAdmin = useServerFn(isCurrentUserAdmin);
  const { data: isAdmin, isLoading: adminLoading } = useQuery({
    queryKey: ["me", "isAdmin"],
    queryFn: () => checkAdmin(),
    staleTime: 60_000,
  });
  const [range, setRange] = useState<Range>("month");
  const dates = useMemo(() => rangeToDates(range), [range]);
  const params = useMemo(() => ({ ...dates, chartWindow: range }), [dates, range]);
  const showProjection = range === "month" || range === "three-months";
  const fetchStats = useServerFn(getDashboardStats);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", params],
    queryFn: () => fetchStats({ data: params }),
    enabled: isAdmin === true,
  });
  const fetchForecast = useServerFn(getForecastStats);
  const { data: forecast } = useQuery({
    queryKey: ["dashboard", "forecast"],
    queryFn: () => fetchForecast(),
    enabled: isAdmin === true,
  });

  if (adminLoading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>;
  }
  if (isAdmin === false) {
    return <Navigate to="/atendimentos" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral financeira dos atendimentos</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
            <TabsList>
              <TabsTrigger value="month">Mês atual</TabsTrigger>
              <TabsTrigger value="three-months">3 meses</TabsTrigger>
              <TabsTrigger value="year">Ano</TabsTrigger>
              <TabsTrigger value="all">Tudo</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button asChild>
            <Link to="/atendimentos/novo">
              <Plus className="mr-2 h-4 w-4" /> Novo
            </Link>
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="mt-3 h-8 w-32 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Consolidado (Entradas x Saídas)</h2>
              <p className="text-xs text-muted-foreground">
                Resultado de caixa do período selecionado — entradas são a receita bruta dos atendimentos
                concluídos; saídas incluem custos, impostos e despesas pagas.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <KpiCard
                label="Entradas"
                value={brl(data.cashflow.inflow)}
                icon={ArrowDownRight}
                tone="muted"
                projected={showProjection ? data.projection.gross : undefined}
              />
              <KpiCard
                label="Saídas"
                value={brl(data.cashflow.outflow)}
                icon={ArrowUpRight}
                tone="muted"
                projected={showProjection ? data.projection.expenses + data.projection.tax : undefined}
              />
              <Card className={data.cashflow.result >= 0 ? "border-emerald-500/50" : "border-destructive/50"}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Resultado
                    </span>
                    <Wallet
                      className={
                        "h-4 w-4 " +
                        (data.cashflow.result >= 0 ? "text-emerald-600" : "text-destructive")
                      }
                    />
                  </div>
                  <div
                    className={
                      "mt-2 text-2xl font-semibold tabular-nums " +
                      (data.cashflow.result >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive")
                    }
                  >
                    {brl(data.cashflow.result)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Resultado de caixa, inclui despesas
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Saídas por natureza</CardTitle>
              </CardHeader>
              <CardContent>
                {data.cashflow.outflow === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem saídas no período.</p>
                ) : (
                  <ul className="divide-y">
                    <BreakdownRow
                      label="Custos de atendimento"
                      value={data.outflowBreakdown.custosAtendimento}
                      inflow={data.cashflow.inflow}
                    />
                    <BreakdownRow
                      label="Impostos e taxas"
                      value={data.outflowBreakdown.impostosTaxas}
                      inflow={data.cashflow.inflow}
                    />
                    {data.outflowBreakdown.demaisDespesas.map((d) => (
                      <BreakdownRow
                        key={d.category}
                        label={d.category}
                        value={d.total}
                        inflow={data.cashflow.inflow}
                      />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>

          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard label="Atendimentos" value={String(data.count)} tone="muted" />
            <KpiCard label="Clientes ativos" value={String(data.activeClients)} tone="muted" />
            <KpiCard label="Ticket médio (líquido)" value={brl(data.averageTicket)} tone="muted" />
            <Card className="border-amber-400/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Provisão (30 dias)
                  </span>
                  <CalendarClock className="h-4 w-4 text-amber-600" />
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                  {brl(forecast?.next30.gross ?? 0)}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("provisao-futura")?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className="mt-1 text-xs text-amber-700 underline underline-offset-2 hover:opacity-80 dark:text-amber-400"
                >
                  Ver detalhes da provisão
                </button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lucro Líquido por mês</CardTitle>
            </CardHeader>
              <CardContent>
                {data.byMonth.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.byMonth}>
                      <defs>
                        <pattern id="provPattern" patternUnits="userSpaceOnUse" width={6} height={6}>
                          <rect width="6" height="6" fill="#2563eb" fillOpacity={0.18} />
                          <path d="M0,6 l6,-6 M-1.5,1.5 l3,-3 M4.5,7.5 l3,-3" stroke="#2563eb" strokeWidth={1.4} />
                        </pattern>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                      <XAxis dataKey="month" tickFormatter={(v) => v.slice(5) + "/" + v.slice(2, 4)} fontSize={12} />
                      <YAxis tickFormatter={(v) => `R$${v / 1000}k`} fontSize={12} />
                      <Tooltip
                        formatter={(v: number, name: string) => [
                          brl(v),
                          name === "net" ? "Líquido realizado" : "Provisão estimada",
                        ]}
                        labelFormatter={(l) => `Mês: ${l}`}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 12 }}
                        formatter={(value: string) => (value === "net" ? "Líquido realizado" : "Provisão estimada")}
                      />
                      <Bar dataKey="net" stackId="m" fill="#2563eb" name="net" radius={[0, 0, 0, 0]} />
                      <Bar
                        dataKey="provisionedNet"
                        stackId="m"
                        fill="url(#provPattern)"
                        fillOpacity={0.45}
                        stroke="#2563eb"
                        strokeOpacity={0.5}
                        strokeDasharray="3 2"
                        name="provisionedNet"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
            </CardContent>
          </Card>

          <section
            id="provisao-futura"
            className="scroll-mt-20 rounded-lg border-2 border-dashed border-amber-400/70 bg-amber-50/40 p-4 dark:bg-amber-950/10"
          >
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber-600" />
              <h2 className="text-lg font-semibold">Provisão futura (não realizado)</h2>
              <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                Estimativa
              </Badge>
              <p className="w-full text-xs text-muted-foreground">
                Valores esperados de atendimentos com status "agendado" e despesas ainda pendentes — não entram nos
                números consolidados acima.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ForecastCard title="Próximos 7 dias" w={forecast?.next7} />
              <ForecastCard title="Próximos 30 dias" w={forecast?.next30} />
            </div>


            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium">Próximos agendamentos</h3>
              {!forecast || forecast.upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum agendamento futuro.</p>
              ) : (
                <ul className="divide-y rounded-md border bg-background">
                  {forecast.upcoming.map((u) => (
                    <li key={u.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div>
                        <div className="font-medium">{u.client_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTimeBR(u.scheduled_at)} · {u.procedure}
                        </div>
                      </div>
                      <div className="text-right tabular-nums">
                        <div className="font-semibold">{brl(u.gross_value)}</div>
                        <div className="text-xs text-muted-foreground">líq. {brl(u.net_value)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Por procedimento</CardTitle>
              </CardHeader>
              <CardContent>
                {data.byProcedure.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={data.byProcedure}
                        dataKey="net"
                        nameKey="procedure"
                        innerRadius={50}
                        outerRadius={90}
                      >
                        {data.byProcedure.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => brl(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Top clientes</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados no período.</p>
                ) : (
                  <ul className="divide-y">
                    {data.topClients.map((c) => (
                      <li key={c.client} className="flex items-center justify-between py-3">
                        <div>
                          <div className="font-medium">{c.client}</div>
                          <div className="text-xs text-muted-foreground">{c.count} atendimento(s)</div>
                        </div>
                        <div className="font-semibold tabular-nums">{brl(c.net)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Últimos atendimentos</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/atendimentos">
                    Ver todos <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {data.recent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados no período.</p>
                ) : (
                  <ul className="divide-y">
                    {data.recent.map((r) => (
                      <li key={r.id} className="flex items-center justify-between py-3">
                        <div>
                          <div className="font-medium">{r.client_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateBR(r.date)} · {r.procedure}
                          </div>
                        </div>
                        <div className="font-semibold tabular-nums">{brl(Number(r.net_value))}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function pctOfInflow(part: number, inflow: number): string {
  if (!inflow) return "—";
  const pct = (part / inflow) * 100;
  return `${pct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% das entradas`;
}

function BreakdownRow({ label, value, inflow }: { label: string; value: number; inflow: number }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <span>{label}</span>
      <span className="flex items-baseline gap-3 tabular-nums">
        <span className="text-xs text-muted-foreground">{pctOfInflow(value, inflow)}</span>
        <span className="font-semibold">{brl(value)}</span>
      </span>
    </li>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "muted",
  percent,
  projected,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "muted" | "primary";
  percent?: string;
  projected?: number;
}) {
  return (
    <Card className={tone === "primary" ? "border-primary/40 bg-primary/5" : undefined}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          {Icon && <Icon className={"h-4 w-4 " + (tone === "primary" ? "text-primary" : "text-muted-foreground")} />}
        </div>
        <div className={"mt-2 text-2xl font-semibold tabular-nums " + (tone === "primary" ? "text-primary" : "")}>
          {value}
        </div>
        {percent && (
          <div className={"mt-1 text-xs " + (tone === "primary" ? "text-primary/80" : "text-muted-foreground")}>
            {percent}
          </div>
        )}
        {projected !== undefined && projected > 0 && (
          <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">+ {brl(projected)} projetado</div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="grid h-[280px] place-items-center text-sm text-muted-foreground">
      Sem dados no período.
    </div>
  );
}

function formatDateTimeBR(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function ForecastCard({
  title,
  w,
}: {
  title: string;
  w?: { gross: number; net: number; count: number; expenseTotal: number; expenseCount: number };
}) {
  return (
    <Card className="border-amber-400/60 bg-background">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
          <span className="text-xs text-muted-foreground">{w ? `${w.count} agendamento(s)` : "—"}</span>
        </div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">Entradas previstas</div>
            <div className="text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
              {brl(w?.net ?? 0)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Bruto esperado: {brl(w?.gross ?? 0)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Saídas previstas</div>
            <div className="text-2xl font-semibold tabular-nums text-destructive">
              {brl(w?.expenseTotal ?? 0)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {w?.expenseCount ?? 0} despesa(s) pendente(s)
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


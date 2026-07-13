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
import { getDashboardStats } from "@/lib/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, formatDateBR } from "@/lib/format";
import { TrendingUp, Receipt, Percent, DollarSign, Plus, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
  errorComponent: ({ error }) => <div className="text-destructive">{error.message}</div>,
  notFoundComponent: () => <div>Nada encontrado.</div>,
});

type Range = "month" | "last-month" | "year" | "all";

function rangeToDates(r: Range): { from?: string; to?: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (r === "month") return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
  if (r === "last-month") return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
  if (r === "year") return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) };
  return {};
}

const PIE_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9", "#f97316"];

function Dashboard() {
  const [range, setRange] = useState<Range>("month");
  const dates = useMemo(() => rangeToDates(range), [range]);
  const fetchStats = useServerFn(getDashboardStats);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", dates],
    queryFn: () => fetchStats({ data: dates }),
  });

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
              <TabsTrigger value="last-month">Mês passado</TabsTrigger>
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
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard label="Receita Bruta" value={brl(data.totalGross)} icon={DollarSign} tone="muted" />
            <KpiCard
              label="Despesas"
              value={brl(data.totalExpenses)}
              icon={Receipt}
              tone="muted"
              percent={pctOf(data.totalExpenses, data.totalGross)}
            />
            <KpiCard
              label="Impostos / Taxas"
              value={brl(data.totalTax)}
              icon={Percent}
              tone="muted"
              percent={pctOf(data.totalTax, data.totalGross)}
            />
            <KpiCard
              label="Lucro Líquido"
              value={brl(data.totalNet)}
              icon={TrendingUp}
              tone="primary"
              percent={pctOf(data.totalNet, data.totalGross)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard label="Atendimentos" value={String(data.count)} tone="muted" />
            <KpiCard label="Ticket médio (líquido)" value={brl(data.averageTicket)} tone="muted" />
            <KpiCard label="Clientes ativos" value={String(data.activeClients)} tone="muted" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Lucro Líquido por mês</CardTitle>
              </CardHeader>
              <CardContent>
                {data.byMonth.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.byMonth}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                      <XAxis dataKey="month" tickFormatter={(v) => v.slice(5) + "/" + v.slice(2, 4)} fontSize={12} />
                      <YAxis tickFormatter={(v) => `R$${v / 1000}k`} fontSize={12} />
                      <Tooltip formatter={(v: number) => brl(v)} labelFormatter={(l) => `Mês: ${l}`} />
                      <Bar dataKey="net" fill="#2563eb" radius={[4, 4, 0, 0]} name="Líquido" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
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
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
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

function pctOf(part: number, total: number): string | undefined {
  if (!total) return undefined;
  const pct = (part / total) * 100;
  return `${pct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% da receita bruta`;
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "muted",
  percent,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "muted" | "primary";
  percent?: string;
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

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { brl } from "@/lib/format";
import { donutPercentage, formatDonutPercentage, type DonutItem } from "@/lib/donut-data";

export function PercentageDonut({ items }: { items: DonutItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="min-w-0">
      <ResponsiveContainer width="100%" height={230}>
        <PieChart>
          <Pie
            data={items}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={90}
            labelLine={false}
            isAnimationActive={false}
            label={({ cx, cy, midAngle, outerRadius, value }) => {
              if (donutPercentage(Number(value), total) < 5) return null;
              const angle = -Number(midAngle) * Math.PI / 180;
              const radius = Number(outerRadius) + 14;
              return <text x={Number(cx) + radius * Math.cos(angle)} y={Number(cy) + radius * Math.sin(angle)} textAnchor={Math.cos(angle) >= 0 ? "start" : "end"} dominantBaseline="central" className="fill-foreground text-xs">{formatDonutPercentage(Number(value), total)}</text>;
            }}
          >
            {items.map((item) => <Cell key={item.name} fill={item.color} stroke="var(--card)" />)}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              const item = payload?.[0]?.payload as DonutItem | undefined;
              if (!active || !item) return null;
              return <div className="max-w-64 rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md"><p className="font-medium">{item.name}</p><p className="tabular-nums">{brl(item.value)} · {formatDonutPercentage(item.value, total)}</p></div>;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="space-y-1.5 text-xs" aria-label="Legenda do gráfico">
        {items.map((item) => <li key={item.name} className="flex min-w-0 items-start gap-2"><svg width="10" height="10" className="mt-0.5 shrink-0" aria-hidden="true"><circle cx="5" cy="5" r="5" fill={item.color} /></svg><span className="min-w-0 break-words">{item.name} — {formatDonutPercentage(item.value, total)}</span></li>)}
      </ul>
    </div>
  );
}
export type DonutItem = { name: string; value: number; color: string };

export const DONUT_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)",
];

export function groupOutflowSlices(items: DonutItem[]) {
  const positive = items.filter((item) => item.value > 0);
  if (positive.length <= 6) return { slices: positive, colors: new Map(items.map((item) => [item.name, item.color])) };
  const ranked = [...positive].sort((a, b) => b.value - a.value);
  const kept = ranked.slice(0, 5);
  const grouped = ranked.slice(5);
  const otherColor = DONUT_COLORS[5];
  const colors = new Map(items.map((item) => [item.name, grouped.some((entry) => entry.name === item.name) ? otherColor : item.color]));
  return {
    slices: [...kept, { name: "Outras", value: grouped.reduce((sum, item) => sum + item.value, 0), color: otherColor }],
    colors,
  };
}

export function donutPercentage(value: number, total: number) {
  return total > 0 ? value / total * 100 : 0;
}

export function formatDonutPercentage(value: number, total: number) {
  return `${donutPercentage(value, total).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
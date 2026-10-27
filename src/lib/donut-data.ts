export type DonutItem = { name: string; value: number; color: string };

export const DONUT_COLORS = [
  "var(--donut-blue)", "var(--donut-green)", "var(--donut-amber)",
  "var(--donut-red)", "var(--donut-purple)", "var(--donut-cyan)",
];
export const DONUT_OTHER_COLOR = "var(--donut-other)";

export function groupOutflowSlices(items: DonutItem[]) {
  const positive = items.filter((item) => item.value > 0);
  const colors = new Map(items.map((item, index) => [item.name, DONUT_COLORS[index % DONUT_COLORS.length]]));
  if (positive.length <= 6) {
    const slices = positive.map((item, index) => ({ ...item, color: DONUT_COLORS[index] }));
    slices.forEach((item) => colors.set(item.name, item.color));
    return { slices, colors };
  }
  const ranked = [...positive].sort((a, b) => b.value - a.value);
  const kept = ranked.slice(0, 5);
  const grouped = ranked.slice(5);
  const otherColor = DONUT_OTHER_COLOR;
  const coloredKept = kept.map((item, index) => ({ ...item, color: DONUT_COLORS[index] }));
  coloredKept.forEach((item) => colors.set(item.name, item.color));
  grouped.forEach((item) => colors.set(item.name, otherColor));
  return {
    slices: [...coloredKept, { name: "Outras", value: grouped.reduce((sum, item) => sum + item.value, 0), color: otherColor }],
    colors,
  };
}

export function donutPercentage(value: number, total: number) {
  return total > 0 ? value / total * 100 : 0;
}

export function formatDonutPercentage(value: number, total: number) {
  return `${donutPercentage(value, total).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
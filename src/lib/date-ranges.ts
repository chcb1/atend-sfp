/** Mês âncora no fuso America/Sao_Paulo (mesma abordagem do dashboard: Intl.DateTimeFormat). */
function saoPauloYearMonth(d = new Date()): [number, number] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  return [y, m - 1];
}

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(end) };
}

export function thisMonthRange() {
  const [y, m] = saoPauloYearMonth();
  return monthRange(y, m);
}

export function lastMonthRange() {
  const [y, m] = saoPauloYearMonth();
  return monthRange(y, m - 1);
}

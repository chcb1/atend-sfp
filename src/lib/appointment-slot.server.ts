const SP_TZ = "America/Sao_Paulo";

/** Offset (em minutos) do fuso de São Paulo em um instante UTC. */
function spOffsetMinutes(utc: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(utc);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return (asUtc - utc.getTime()) / 60000;
}

/** Retorna o instante UTC correspondente a HH:00 no fuso America/Sao_Paulo da data informada. */
export function saoPauloHourUtc(dateIso: string, hour: number): Date {
  const naive = Date.UTC(
    Number(dateIso.slice(0, 4)),
    Number(dateIso.slice(5, 7)) - 1,
    Number(dateIso.slice(8, 10)),
    hour,
    0,
    0,
  );
  const offset = spOffsetMinutes(new Date(naive));
  return new Date(naive - offset * 60000);
}

/**
 * Encontra um horário livre a partir do meio-dia (São Paulo) da data informada,
 * escalonando +1h enquanto houver outro atendimento ocupando a faixa.
 * Mesma lógica do backfill da migration da agenda.
 */
export async function findFreeNoonSlot(
  supabase: any,
  dateIso: string,
  durationMinutes = 60,
  excludeId?: string,
): Promise<string> {
  const dayStart = saoPauloHourUtc(dateIso, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60000);

  let q = supabase
    .from("appointments")
    .select("id, scheduled_at, duration_minutes, status")
    .not("scheduled_at", "is", null)
    .in("status", ["agendado", "concluido"])
    .gte("scheduled_at", dayStart.toISOString())
    .lt("scheduled_at", dayEnd.toISOString());
  if (excludeId) q = q.neq("id", excludeId);

  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);

  const busy = (rows ?? []).map((r: any) => {
    const start = new Date(r.scheduled_at).getTime();
    return { start, end: start + (r.duration_minutes ?? 60) * 60000 };
  });

  for (let i = 0; i < 24; i++) {
    const start = saoPauloHourUtc(dateIso, 12).getTime() + i * 60 * 60000;
    const end = start + durationMinutes * 60000;
    const clash = busy.some((b: { start: number; end: number }) => start < b.end && end > b.start);
    if (!clash) return new Date(start).toISOString();
  }
  return saoPauloHourUtc(dateIso, 12).toISOString();
}

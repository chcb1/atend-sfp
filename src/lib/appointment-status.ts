import type { AppointmentStatus } from "@/lib/types";

/** Mapeamento de classes de status reaproveitado entre Agenda e Atendimentos. */
export const statusStyles: Record<AppointmentStatus, string> = {
  agendado: "border-l-4 border-l-blue-500 bg-blue-500/5",
  concluido: "border-l-4 border-l-emerald-600 bg-emerald-600/5",
  cancelado: "border-l-4 border-l-muted-foreground bg-muted/40 opacity-70",
};

export const statusLabels: Record<AppointmentStatus, string> = {
  agendado: "Agendado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

/** Classes de badge colorido por status (texto + fundo). */
export const statusBadgeClass: Record<AppointmentStatus, string> = {
  agendado: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  concluido: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300",
  cancelado: "bg-muted text-muted-foreground",
};

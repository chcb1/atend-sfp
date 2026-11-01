import type { AppointmentStatus } from "@/lib/types";

/** Mapeamento de classes de status reaproveitado entre Agenda e Atendimentos. */
export const statusStyles: Record<AppointmentStatus, string> = {
  agendado: "rounded-[10px] border-l-4 border-l-status-agendado-edge bg-status-agendado-bg text-status-agendado-block",
  concluido: "rounded-[10px] border-l-4 border-l-status-concluido-edge bg-status-concluido-bg text-status-concluido-block",
  cancelado: "rounded-[10px] border-l-4 border-l-status-cancelado-edge bg-status-cancelado-block-bg text-status-cancelado-fg",
};

export const statusLabels: Record<AppointmentStatus, string> = {
  agendado: "Agendado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

/** Classes de badge colorido por status (texto + fundo). */
export const statusBadgeClass: Record<AppointmentStatus, string> = {
  agendado: "rounded-full border-0 text-xs font-bold bg-status-agendado-bg text-status-agendado-fg",
  concluido: "rounded-full border-0 text-xs font-bold bg-status-concluido-bg text-status-concluido-fg",
  cancelado: "rounded-full border-0 text-xs font-bold bg-status-cancelado-bg text-status-cancelado-fg",
};

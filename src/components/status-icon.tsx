import { Check, Clock, X } from "lucide-react";
import type { AppointmentStatus } from "@/lib/types";

const icons = { agendado: Clock, concluido: Check, cancelado: X } as const;

export function StatusIcon({ status, className = "h-3 w-3" }: { status: AppointmentStatus; className?: string }) {
  const Icon = icons[status];
  return <Icon className={className} aria-hidden="true" />;
}

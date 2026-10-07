import { createFileRoute } from "@tanstack/react-router";
import { AppointmentForm } from "@/components/appointment-form";

export const Route = createFileRoute("/_authenticated/atendimentos/novo")({
  component: () => <AppointmentForm />,
  errorComponent: ({ error }) => <div className="text-destructive">{(error as Error).message}</div>,
  notFoundComponent: () => <div>Nada encontrado.</div>,
});

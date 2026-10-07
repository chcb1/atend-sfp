import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAppointment } from "@/lib/appointments.functions";
import { AppointmentForm } from "@/components/appointment-form";

export const Route = createFileRoute("/_authenticated/atendimentos/$id/editar")({
  component: EditAppointment,
  errorComponent: ({ error }) => <div className="text-destructive">{(error as Error).message}</div>,
  notFoundComponent: () => <div>Atendimento não encontrado.</div>,
});

function EditAppointment() {
  const { id } = Route.useParams();
  const fetchFn = useServerFn(getAppointment);
  const { data, isLoading } = useQuery({
    queryKey: ["appointment", id],
    queryFn: () => fetchFn({ data: { id } }),
  });
  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>;
  if (!data) return <div>Atendimento não encontrado.</div>;
  return <AppointmentForm appointment={data} />;
}

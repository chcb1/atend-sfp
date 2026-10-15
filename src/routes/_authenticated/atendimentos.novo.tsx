import { createFileRoute } from "@tanstack/react-router";
import { AppointmentForm } from "@/components/appointment-form";

export const Route = createFileRoute("/_authenticated/atendimentos/novo")({
  head: () => ({ meta: [
    { title: "Novo atendimento — Fisio App" },
    { name: "description", content: "Cadastre um atendimento no Fisio App." },
    { property: "og:title", content: "Novo atendimento — Fisio App" },
    { property: "og:description", content: "Cadastre um atendimento no Fisio App." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AppointmentForm />,
  errorComponent: ({ error }) => <div className="text-destructive">{(error as Error).message}</div>,
  notFoundComponent: () => <div>Nada encontrado.</div>,
});

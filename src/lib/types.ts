export type Client = {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Procedure = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  default_value: number;
  created_at: string;
  updated_at: string;
};


export type AppointmentStatus = "agendado" | "concluido" | "cancelado";

export type Appointment = {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  status: AppointmentStatus;
  scheduled_at: string | null;
  duration_minutes: number;
  procedure_id: string | null;
  client_id: string | null;
  client_name: string;
  procedure: string;
  gross_value: number;
  expenses: number;
  tax: number;
  net_value: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DashboardStats = {
  totalGross: number;
  totalExpenses: number;
  totalTax: number;
  totalNet: number;
  count: number;
  averageTicket: number;
  activeClients: number;
  byMonth: { month: string; net: number; gross: number; provisionedNet?: number }[];
  byProcedure: { procedure: string; net: number }[];
  topClients: { client: string; net: number; count: number }[];
  recent: Appointment[];
};

export type ForecastWindow = {
  gross: number;
  net: number;
  count: number;
};

export type ForecastStats = {
  next7: ForecastWindow;
  next30: ForecastWindow;
  upcoming: {
    id: string;
    scheduled_at: string;
    client_name: string;
    procedure: string;
    gross_value: number;
    net_value: number;
  }[];
};

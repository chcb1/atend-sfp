import * as XLSX from "xlsx";
import type { Appointment } from "./types";
import { formatDateBR } from "./format";

export function exportAppointmentsToXlsx(rows: Appointment[], filename = "atendimentos.xlsx") {
  const data = rows.map((r) => ({
    Data: formatDateBR(r.date),
    Cliente: r.client_name,
    Procedimento: r.procedure,
    "Valor Bruto": Number(r.gross_value),
    Despesas: Number(r.expenses),
    "Imposto/Taxa": Number(r.tax),
    "Valor Líquido": Number(r.net_value),
  }));

  const totals = rows.reduce(
    (acc, r) => {
      acc.gross += Number(r.gross_value);
      acc.exp += Number(r.expenses);
      acc.tax += Number(r.tax);
      acc.net += Number(r.net_value);
      return acc;
    },
    { gross: 0, exp: 0, tax: 0, net: 0 },
  );

  data.push({
    Data: "TOTAL",
    Cliente: "",
    Procedimento: "",
    "Valor Bruto": totals.gross,
    Despesas: totals.exp,
    "Imposto/Taxa": totals.tax,
    "Valor Líquido": totals.net,
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 },
    { wch: 24 },
    { wch: 24 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Atendimentos");
  XLSX.writeFile(wb, filename);
}

import ExcelJS from "exceljs";
import type { Appointment } from "./types";
import { formatDateBR } from "./format";

export async function exportAppointmentsToXlsx(
  rows: Appointment[],
  filename = "atendimentos.xlsx",
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Atendimentos");

  ws.columns = [
    { header: "Data", key: "date", width: 12 },
    { header: "Cliente", key: "client", width: 24 },
    { header: "Procedimento", key: "procedure", width: 24 },
    { header: "Valor Bruto", key: "gross", width: 14 },
    { header: "Despesas", key: "expenses", width: 12 },
    { header: "Imposto/Taxa", key: "tax", width: 14 },
    { header: "Valor Líquido", key: "net", width: 14 },
  ];

  for (const r of rows) {
    ws.addRow({
      date: formatDateBR(r.date),
      client: r.client_name,
      procedure: r.procedure,
      gross: Number(r.gross_value),
      expenses: Number(r.expenses),
      tax: Number(r.tax),
      net: Number(r.net_value),
    });
  }

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

  ws.addRow({
    date: "TOTAL",
    client: "",
    procedure: "",
    gross: totals.gross,
    expenses: totals.exp,
    tax: totals.tax,
    net: totals.net,
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

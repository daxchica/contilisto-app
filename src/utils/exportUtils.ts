import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { JournalEntry } from "../types/JournalEntry";

// Format date as yyyy-mm-dd
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Export to PDF
export function exportAccountToPDF(
  accountCode: string,
  accountName: string,
  entries: JournalEntry[]
) {
  const doc = new jsPDF();
  const totalDebits = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredits = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
  const saldoFinal = totalDebits - totalCredits;

  doc.setFontSize(14);
  doc.text(`Libro Mayor - Cuenta ${accountCode} - ${accountName}`, 14, 15);

  autoTable(doc, {
    startY: 20,
    head: [["Fecha", "Descripción", "Débito", "Crédito"]],
    body: entries.map((e) => [
      formatDate(e.date),
      e.description,
      e.debit?.toFixed(2) || "-",
      e.credit?.toFixed(2) || "-",
    ]),
  });

  doc.setFontSize(12);
  doc.text(
    `Total Débitos: $${totalDebits.toFixed(2)}\nTotal Créditos: $${totalCredits.toFixed(
      2
    )}\nSaldo Final: $${saldoFinal.toFixed(2)}`,
    14,
    doc.lastAutoTable.finalY + 10
  );

  doc.save(`LibroMayor_${accountCode}.pdf`);
}

// Export to CSV
export function exportAccountToCSV(
  accountCode: string,
  accountName: string,
  entries: {
    date: string;
    description: string;
    debit?: number;
    credit?: number;
  }[]
) {
  const headers = ["Fecha", "Descripción", "Débito", "Crédito"];
  
  const rows = entries.map((e) => [
    formatDate(e.date),
    e.description.replace(/,/g, " "), // removes blanks and commas
    e.debit?.toFixed(2) || "",
    e.credit?.toFixed(2) || "",
  ]);


  const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");

  // bom PARA COMPATIBILIDAD utf-8 en Excel

  const csvWithBOM = "\uFEFF" + csvContent;
  const blob = new Blob([csvWithBOM], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const filename = `LibroMayor_${accountCode}_${accountName.replace(/ /g, "_")}.csv`;

  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
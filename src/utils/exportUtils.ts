import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { JournalEntry } from "../types/JournalEntry";

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
      new Date(e.date).toLocaleDateString("es-EC"),
      e.description,
      e.debit?.toFixed(2) || "-",
      e.credit?.toFixed(2) || "-",
    ]),
  });

  doc.text(
    `Total Débitos: $${totalDebits.toFixed(2)}\nTotal Créditos: $${totalCredits.toFixed(
      2
    )}\nSaldo Final: $${saldoFinal.toFixed(2)}`,
    14,
    doc.lastAutoTable.finalY + 10
  );

  doc.save(`LibroMayor_${accountCode}.pdf`);
}
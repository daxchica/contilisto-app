// src/utils/exportUtils.ts
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

  const finalY =
    ((doc as any).lastAutoTable && (doc as any).lastAutoTable.finalY) || 20;

  doc.setFontSize(12);
  doc.text(
    `Total Débitos: $${totalDebits.toFixed(2)
    }\nTotal Créditos: $${totalCredits.toFixed(
      2)
    }\nSaldo Final: $${saldoFinal.toFixed(2)}`,
    14,
    finalY + 10
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


  const csvContent = [headers, ...rows]
    .map((row) => row.join(","))
    .join("\n");

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

// =========================================================
// PDF completo del Libro Mayor (todas las cuentas filtradas)
// =========================================================
export function exportFullLedgerToPDF(
  entityName: string,
  entityRuc: string,
  groupedByAccount: Record<string, JournalEntry[]>
) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageHeight = doc.internal.pageSize.height;

  const now = new Date();

  // Encabezado general
  doc.setFontSize(18);
  doc.text("Libro Mayor - Contilisto", 40, 40);

  doc.setFontSize(11);
  doc.text(`Empresa: ${entityName || "-"}`, 40, 65);
  doc.text(`RUC: ${entityRuc}`, 40, 82);
  doc.text(
    `Fecha de emisión: ${formatDate(now.toISOString())}`, 40, 99);

  let currentY = 130;

  const sortedAccounts = Object.entries(groupedByAccount).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  if (!sortedAccounts.length) {
    doc.text("No hay movimientos para exportar.", 14, 55);
    doc.save(
      `LibroMayor_${entityRuc || entityName || "sin_empresa"}.pdf`
    );
    return;
  }

  for (const [code, entries] of sortedAccounts) {
    if (!entries.length) continue;

    const accountName = entries[0]?.account_name || "";
    const totalDebits = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredits = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
    const saldoFinal = totalDebits - totalCredits;


    if (currentY > pageHeight - 180) {
      doc.addPage();
      currentY = 60;
    }

    // Título de cuenta
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`Cuenta: ${code} — ${accountName}`, 40, currentY);
      currentY += 12;

    (autoTable as any)(doc, {
      startY: currentY + 5,
      head: [["Fecha", "Descripción", "Débito", "Crédito"]],
      body: entries.map((e) => [
        formatDate(e.date),
        e.description,
        e.debit?.toFixed(2) || "-",
        e.credit?.toFixed(2) || "-",
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [10, 53, 88], textColor: "#fff" }, // azul contilisto sutil
      theme: "grid",
    });

    const tableY = (doc as any).lastAutoTable.finalY;

    if (tableY + 40 > pageHeight - 40) {
      doc.addPage();
      currentY = 60;
    } else {
      currentY = tableY + 20;
    }
      
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(
      `Total Débitos: $${totalDebits.toFixed(2)}   `+
      `Total Créditos: $${totalCredits.toFixed(2)}   `+
      `Saldo Final: $${saldoFinal.toFixed(2)}`,
      40,
      currentY
    );

    currentY += 40;
  }

  doc.save(`LibroMayor_${entityRuc || entityName}.pdf`);
}
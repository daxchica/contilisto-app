import React from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface Entry {
  account_code: string;
  account_name: string;
  debit?: number;
  credit?: number;
}

interface Props {
  entries: Entry[];
}

export default function BalanceSheetDisplay({ entries }: Props) {
  const assets = entries.filter(e => e.account_code.startsWith("1"));
  const liabilities = entries.filter(e => e.account_code.startsWith("2"));
  const equity = entries.filter(e => e.account_code.startsWith("3"));

  const totalDebits = assets.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredits = [...liabilities, ...equity].reduce((sum, e) => sum + (e.credit || 0), 0);

  const formatAmount = (amount?: number) =>
    typeof amount === "number" ? amount.toLocaleString("en-US", { style: "currency", currency: "USD" }) : "$0.00";

  const exportToPDF = () => {
    const doc = new jsPDF();
    const now = new Date().toLocaleDateString();

    doc.setFontSize(16);
    doc.text("Balance Sheet", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${now}`, 14, 28);

    let y = 36;

    const section = (title: string, entries: Entry[]) => {
      doc.setFont(undefined, "bold");
      doc.text(title, 14, y);
      y += 6;
      doc.setFont(undefined, "normal");
      entries.forEach((e) => {
        const amount = e.debit ?? e.credit ?? 0;
        doc.text(`${e.account_code} - ${e.account_name}`, 14, y);
        doc.text(formatAmount(amount), 160, y, { align: "right" });
        y += 6;
      });
      y += 6;
    };

    section("Assets", assets);
    section("Liabilities", liabilities);
    section("Equity", equity);

    doc.setFont(undefined, "bold");
    doc.text(`Total Assets: ${formatAmount(totalDebits)}`, 14, y);
    y += 6;
    doc.text(`Total Liabilities + Equity: ${formatAmount(totalCredits)}`, 14, y);

    doc.save("Balance_Sheet.pdf");
  };

  return (
    <div className="bg-white shadow rounded p-4 mt-6 border">
      <h2 className="text-xl font-bold text-blue-800 mb-4">📋 Hoja de Balance </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-green-700 font-bold mb-2">Activos</h3>
          {assets.map((e, i) => (
            <div key={i} className="text-sm">
              {e.account_code} - {e.account_name}: {formatAmount(e.debit)}
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-red-700 font-bold mb-2">Pasivos & Patrimonio</h3>
          {[...liabilities, ...equity].map((e, i) => (
            <div key={i} className="text-sm">
              {e.account_code} - {e.account_name}: {formatAmount(e.credit)}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 font-semibold">
        <div>Total Activos: {formatAmount(totalDebits)}</div>
        <div>Total Pasivos + Patrimonio: {formatAmount(totalCredits)}</div>
      </div>

      <div className="mt-6 flex justify-center">
        <button
          onClick={exportToPDF}
          className="px-6 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700"
        >
          📄 Exporta Balance de Situacion en PDF
        </button>
      </div>
    </div>
  );
}
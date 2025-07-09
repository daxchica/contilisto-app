import React, { useState } from "react";
import ManualBalanceForm from "./ManualBalanceForm";
import BalancePDFUploader from "./BalancePDFUploader";
import BalanceSheetDisplay from "./BalanceSheetDisplay";

export interface InitialBalance {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
}

export default function InitialBalanceSheetSection() {
  const [mode, setMode] = useState<"manual" | "pdf">("manual");
  const [balances, setBalances] = useState<InitialBalance[]>([]);

  return (
    <div className="mt-8 bg-white p-6 shadow rounded border max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-blue-800 mb-4">
        📊 Hoja de Balance Inicial
      </h2>

      <div className="flex gap-4 mb-6">
        <button
          className={`px-4 py-2 rounded shadow text-white transition ${
            mode === "manual" ? "bg-blue-700" : "bg-blue-500 hover:bg-blue-600"
          }`}
          onClick={() => setMode("manual")}
        >
          ✍️ Ingreso Manual
        </button>
        <button
          className={`px-4 py-2 rounded shadow text-white transition ${
            mode === "pdf" ? "bg-blue-700" : "bg-blue-500 hover:bg-blue-600"
          }`}
          onClick={() => setMode("pdf")}
        >
          📄 Cargar PDF
        </button>
      </div>

      {mode === "manual" && (
        <ManualBalanceForm onSubmit={setBalances} />
      )}

      {mode === "pdf" && (
        <BalancePDFUploader onParsed={setBalances} />
      )}

      {balances.length > 0 && (
        <div className="mt-6">
          <BalanceSheetDisplay data={balances} />

          <div className="flex justify-center mt-4 gap-4">
            <button
              onClick={() => alert("Saving balance sheet...")}
              className="px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              ✅ Grabar Balance Inicial
            </button>
            <button
              onClick={() => (window as any).exportInitialBalancePDF?.(balances)}
              className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              📄 Exportar a PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
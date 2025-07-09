import { useState } from "react";
import { getAllInvoicesForEntity, clearLocalLogForEntity } from "../services/localLogService";

interface InvoiceSearchProps {
  userRUC: string;
}

export default function InvoiceSearch({ userRUC }: InvoiceSearchProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [found, setFound] = useState<boolean | null>(null);
  const [cleared, setCleared] = useState(false);

  const handleSearch = () => {
    const allInvoices = getAllInvoicesForEntity(userRUC);
    const match = allInvoices.includes(search.trim());
    setFound(match);
    setResults(allInvoices.filter(i => i.includes(search.trim())));
  };

  const handleClearLog = () => {
    clearLocalLogForEntity(userRUC);
    setResults([]);
    setSearch("");
    setFound(null);
    setCleared(true);
  }

  return (
    <div className="border rounded p-4 mt-6 bg-gray-50 shadow-sm">
      <h2 className="font-semibold text-gray-800 mb-2">🔍 Buscar Factura Procesada</h2>

      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ej: 001-001-000123456"
          className="border px-3 py-1 rounded w-full"
        />
        <button
          onClick={handleSearch}
          className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
        >
          Buscar
        </button>
      </div>

      {found !== null && (
        <p className={`text-sm ${found ? "text-green-600" : "text-red-500"}`}>
          {found ? "✅ Factura ya fue procesada" : "❌ Factura no encontrada"}
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          Resultados relacionados: {results.length}
          <ul className="list-disc pl-5 mt-1 max-h-24 overflow-y-auto">
            {results.map((num, i) => (
              <li key={i}>{num}</li>
            ))}
          </ul>
        </div>
      )}
      <hr className="my-4" />

      <button
        onClick={handleClearLog}
        className="bg-red-500 text-white px-4 py-1 rounded hover:bg-red-600 text-sm"
      >
        🗑 Borrar log local de facturas procesadas
      </button>

      {cleared && (
        <p className="text-sm mt-2 text-red-500">🚫 Log local eliminado con éxito.</p>
      )}
    </div>
  );
}
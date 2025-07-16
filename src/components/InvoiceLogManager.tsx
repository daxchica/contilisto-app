// components/InvoiceLogManager.tsx
import { useEffect, useState } from "react";
import { 
    getInvoiceLogs, 
    deleteInvoicesFromFirestore, 
    deleteInvoicesFromLocal 
} from "../services/invoiceLogService";

interface InvoiceLogManagerProps {
  entityId: string;
  ruc: string;
}

export default function InvoiceLogManager({ entityId, ruc }: InvoiceLogManagerProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (entityId && ruc) {
      getInvoiceLogs(entityId, ruc).then(setLogs);
    }
  }, [entityId, ruc]);

  const toggleSelection = (invoice: string) => {
    setSelected((prev) => {
        const updated = new Set(prev);
        updated.has(invoice) ? updated.delete(invoice) : updated.add(invoice);
        return updated;
    });
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;

    const confirm = window.confirm("¿Estás seguro de que deseas eliminar las facturas seleccionadas?");
    if (!confirm) return;

    try {
        setLoading(true);
        const invoiceArray = Array.from(selected);
        await deleteInvoicesFromFirestore(entityId, invoiceArray);
        await deleteInvoicesFromLocal(ruc, invoiceArray);
        alert("🗑️ Facturas eliminadas correctamente.");

        const updated = await getInvoiceLogs(entityId, ruc);
        setLogs(updated);
        setSelected(new Set());
    } catch (err) {
        console.error("Error al eliminar facturas:", err);
        alert("Error al eliminar facturas. Ver connectStorageEmulator.");
    } finally {
        setLoading(false);
    }
  };

  if (!logs.length) {
    return (
        <div className="mt-6 border border-gray-300 rounded p-4 text-gray-500 text-sm">
            No hay facturas procesadas aun.
        </div>
    );
  }

  return (
    <div className="mt-6 border border-gray-300 rounded p-4">
      <h3 className="text-lg font-semibold mb-3">🧾 Facturas Procesadas</h3>
      <div className="max-h-48 overflow-y-auto">
        {logs.map((invoice) => (
          <label key={invoice} className="block mb-1">
            <input
              type="checkbox"
              checked={selected.includes(invoice)}
              onChange={() => toggleSelection(invoice)}
              className="mr-2"
            />
            {invoice}
          </label>
        ))}
      </div>
      <button
        onClick={handleDelete}
        disabled={selected.size === 0 || loading }
        className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? "Eliminando..." : "Eliminar Seleccionadas"}
      </button>
    </div>
  );
}
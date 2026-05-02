// ============================================================================
// components/InvoiceLogManager.tsx
// CONTILISTO — PRODUCTION HARDENED VERSION
// ============================================================================

import { useEffect, useState, useRef } from "react";
import {
  getInvoiceLogs,
  deleteInvoicesFromFirestore,
  deleteInvoicesFromLocal,
} from "../services/invoiceLogService";

interface InvoiceLogManagerProps {
  entityId: string;
  ruc: string;
}

export default function InvoiceLogManager({
  entityId,
  ruc,
}: InvoiceLogManagerProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // 🔒 prevents race conditions
  const requestIdRef = useRef(0);

  /* ------------------------------------------------------------------------ */
  /* LOAD LOGS (RACE SAFE)                                                    */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!entityId || !ruc) {
      setLogs([]);
      return;
    }

    const requestId = ++requestIdRef.current;

    getInvoiceLogs(entityId, ruc)
      .then((data) => {
        if (requestId !== requestIdRef.current) return;
        setLogs(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Error loading invoice logs:", err);
        if (requestId !== requestIdRef.current) return;
        setLogs([]);
      });
  }, [entityId, ruc]);

  /* ------------------------------------------------------------------------ */
  /* SELECTION                                                                */
  /* ------------------------------------------------------------------------ */

  const toggleSelection = (invoice: string) => {
    setSelected((prev) => {
      const next = new Set(prev);

      if (next.has(invoice)) {
        next.delete(invoice);
      } else {
        next.add(invoice);
      }

      return next;
    });
  };

  /* ------------------------------------------------------------------------ */
  /* DELETE                                                                   */
  /* ------------------------------------------------------------------------ */

  const handleDelete = async () => {
    if (selected.size === 0 || loading) return;

    const confirmed = window.confirm(
      "¿Estás seguro de que deseas eliminar las facturas seleccionadas?"
    );
    if (!confirmed) return;

    try {
      setLoading(true);

      const invoiceArray = Array.from(selected);

      await deleteInvoicesFromFirestore(entityId, invoiceArray);
      await deleteInvoicesFromLocal(ruc, invoiceArray);

      // reload logs safely
      const updated = await getInvoiceLogs(entityId, ruc);

      setLogs(Array.isArray(updated) ? updated : []);
      setSelected(new Set());

      alert("🗑️ Facturas eliminadas correctamente.");
    } catch (err) {
      console.error("Error al eliminar facturas:", err);
      alert("Error al eliminar facturas.");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* EMPTY STATE                                                              */
  /* ------------------------------------------------------------------------ */

  if (!logs.length) {
    return (
      <div className="mt-6 border border-gray-300 rounded p-4 text-gray-500 text-sm">
        No hay facturas procesadas aún.
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* RENDER                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="mt-6 border border-gray-300 rounded p-4">
      <h3 className="text-lg font-semibold mb-3">
        🧾 Facturas Procesadas
      </h3>

      <div className="max-h-48 overflow-y-auto">
        {logs.map((invoice) => (
          <label key={invoice} className="block mb-1 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.has(invoice)}
              onChange={() => toggleSelection(invoice)}
              className="mr-2"
            />
            {invoice}
          </label>
        ))}
      </div>

      <button
        onClick={handleDelete}
        disabled={selected.size === 0 || loading}
        className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? "Eliminando..." : "Eliminar Seleccionadas"}
      </button>
    </div>
  );
}
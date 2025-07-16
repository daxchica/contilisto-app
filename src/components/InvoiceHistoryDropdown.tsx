// src/components/InvoiceHistoryDropdown.tsx
import { useEffect, useState } from "react";

interface Props {
  invoiceLog: string[];
  onDelete: (toDelete: string[]) => void;
}

export default function InvoiceHistoryDropdown({ invoiceLog, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const toggleInvoice = (invoice: string) => {
    setSelected((prev) =>
      prev.includes(invoice)
        ? prev.filter((i) => i !== invoice)
        : [...prev, invoice]
    );
  };

  const handleDelete = () => {
    if (selected.length > 0) {
      onDelete(selected);
      setSelected([]);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setOpen(!open)}
        className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
      >
        Ver Facturas Procesadas
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white border rounded shadow-lg z-50 max-h-80 overflow-y-auto">
          <div className="p-2">
            {invoiceLog.length === 0 ? (
              <p className="text-gray-500 text-sm">No hay facturas registradas.</p>
            ) : (
              invoiceLog.map((inv, idx) => (
                <label key={idx} className="flex items-center text-sm py-1">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={selected.includes(inv)}
                    onChange={() => toggleInvoice(inv)}
                  />
                  {inv}
                </label>
              ))
            )}
          </div>
          <div className="p-2 border-t text-right">
            <button
              onClick={handleDelete}
              className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
            >
              Eliminar Seleccionadas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
// src/components/InvoiceHistoryDropdown.tsx
import { useEffect, useState, useRef } from "react";

interface Props {
  invoiceLog: string[];
  onDelete: (toDelete: string[]) => void;
}

export default function InvoiceHistoryDropdown({ invoiceLog, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cierra el dropdown si se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

          {invoiceLog.length > 0 && (
            <div className="p-3 border-t flex justify-between items-center">
              <span className="text-xs text-gray-500">
                {selected.length} seleccionada{selected.length !== 1 && "s"}
              </span>
              <button
                onClick={handleDelete}
                disabled={selected.length === 0}
                className={`px-3 py-1 rounded text-sm text-white ${
                  selected.length > 0
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                Eliminar Seleccionadas
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
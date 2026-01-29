import React, { useState } from "react";

export default function InvoiceDebugPanel({ data }: { data: any }) {
  const [open, setOpen] = useState(false);
  if (!data) return null;

  return (
    <div className="mt-4 border rounded-xl bg-slate-50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2 text-left font-semibold text-sm"
      >
        🧪 Debug trace {open ? "▲" : "▼"}
      </button>

      {open && (
        <pre className="max-h-[300px] overflow-auto text-xs p-4 bg-white rounded-b-xl">
          {JSON.stringify(
            {
              invoiceType: data.invoiceType,
              issuerRUC: data.issuerRUC,
              issuerName: data.issuerName,
              buyerName: data.buyerName,
              invoice_number: data.invoice_number,
              totals: {
                subtotal12: data.subtotal12,
                subtotal0: data.subtotal0,
                iva: data.iva,
                total: data.total,
              },
              warnings: data.warnings,
              trace: data.trace, // 👈 if you add it server-side
            },
            null,
            2
          )}
        </pre>
      )}
    </div>
  );
}
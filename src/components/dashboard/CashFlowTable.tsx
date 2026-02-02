// ============================================================================
// src/components/dashboard/CashFlowTable.tsx
// CONTILISTO — Expected Cash Flow (AR / AP)
// Supports historic + projected installments
// ============================================================================

import React from "react";
import type { CashFlowItem } from "@/types/CashFlow";

/* ============================================================================
 * TYPES
 * ========================================================================== */

interface Props {
  items: CashFlowItem[];
}

/* ============================================================================
 * FORMATTERS
 * ========================================================================== */

const formatMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const formatDate = (ts?: number) =>
  ts
    ? new Intl.DateTimeFormat("es-EC").format(new Date(ts))
    : "—";

/* ============================================================================
 * COMPONENT
 * ========================================================================== */

const CashFlowTable: React.FC<Props> = ({ items }) => {
  if (!items.length) {
    return (
      <div className="p-4 bg-gray-50 text-gray-500 text-center rounded">
        No hay flujo de caja proyectado para este período.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white border rounded-lg">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 text-gray-700">
          <tr>
            <th className="px-3 py-2 text-left">Fecha</th>
            <th className="px-3 py-2 text-center">Tipo</th>
            <th className="px-3 py-2 text-left">Parte</th>
            <th className="px-3 py-2 text-center">Factura</th>
            <th className="px-3 py-2 text-center">Flujo</th>
            <th className="px-3 py-2 text-right">Monto</th>
            <th className="px-3 py-2 text-center">Estado</th>
          </tr>
        </thead>

        <tbody>
          {items.map((i, idx) => (
            <tr
              key={`${i.invoiceId}-${i.dueDate}-${idx}`}
              className={`border-t hover:bg-gray-50 ${
                i.status === "overdue" ? "bg-red-50" : ""
              }`}
            >
              {/* Fecha */}
              <td className="px-3 py-2">
                {formatDate(i.dueDate)}
              </td>

              {/* Tipo AR / AP */}
              <td className="px-3 py-2 text-center font-medium">
                {i.type}
              </td>

              {/* Cliente / Proveedor */}
              <td className="px-3 py-2">
                {i.partyName || "—"}
              </td>

              {/* Factura */}
              <td className="px-3 py-2 text-center">
                {i.invoiceNumber || "-"}
              </td>

              {/* Flujo */}
              <td
                className={`px-3 py-2 text-center font-medium ${
                  i.flowDirection === "in"
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {i.flowDirection === "in" ? "Ingreso" : "Egreso"}
              </td>

              {/* Monto */}
              <td
                className={`px-3 py-2 text-right font-medium ${
                  i.flowDirection === "in"
                    ? "text-green-700"
                    : "text-red-700"
                }`}
              >
                {i.flowDirection === "out" ? "-" : "+"}
                {formatMoney(i.amount)}
              </td>

              {/* Estado */}
              <td className="px-3 py-2 text-center">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                    i.status === "paid"
                      ? "bg-green-100 text-green-700"
                      : i.status === "overdue"
                      ? "bg-red-100 text-red-700"
                      : i.status === "partial"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {i.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CashFlowTable;
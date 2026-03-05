// ============================================================================
// Accounts Receivable Aging Report (ERP Drilldown Version)
// src/pages/AccountsReceivableAgingPage.tsx
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { useSelectedEntity } from "@/context/SelectedEntityContext";

import type { Receivable } from "@/types/Receivable";

import { fetchReceivables } from "@/services/receivablesService";
import { buildARAging } from "@/utils/arAging";

export default function AccountsReceivableAgingPage() {
  const { selectedEntity } = useSelectedEntity();
  const entityId = selectedEntity?.id ?? null;

  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  useEffect(() => {
    if (!entityId) return;

    setLoading(true);

    fetchReceivables(entityId)
      .then(setReceivables)
      .finally(() => setLoading(false));
  }, [entityId]);

  /* ------------------------------------------------ */
  /* Aging data                                       */
  /* ------------------------------------------------ */

  const agingRows = useMemo(() => {
    return buildARAging(receivables);
  }, [receivables]);

  const invoicesByCustomer = useMemo(() => {
    const map: Record<string, Receivable[]> = {};

    for (const r of receivables) {
      const customer = r.customerName || "Cliente";

      if (!map[customer]) map[customer] = [];
      map[customer].push(r);
    }

    return map;
  }, [receivables]);

  /* ------------------------------------------------ */
  /* Helpers                                          */
  /* ------------------------------------------------ */

  const today = new Date();

  const daysOld = (date?: string) => {
    if (!date) return 0;
    const diff = today.getTime() - new Date(date).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  /* ------------------------------------------------ */
  /* Guards                                           */
  /* ------------------------------------------------ */

  if (!entityId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">AR Aging</h1>
        <p className="text-sm text-gray-500">
          Selecciona una empresa.
        </p>
      </div>
    );
  }

  if (loading) {
    return <p className="p-6">Cargando aging report…</p>;
  }

  /* ------------------------------------------------ */
  /* UI                                               */
  /* ------------------------------------------------ */

  return (
    <div className="p-6">

      {/* HEADER */}

      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          Accounts Receivable Aging
        </h1>

        <p className="text-sm text-gray-500">
          Antigüedad de cartera por cliente
        </p>
      </div>

      {/* TABLE */}

      <div className="bg-white rounded shadow overflow-x-auto">

        <table className="w-full text-sm">

          <thead className="bg-gray-100">

            <tr>
              <th className="p-3 text-left">Cliente</th>
              <th className="p-3 text-right">Current</th>
              <th className="p-3 text-right">1-30</th>
              <th className="p-3 text-right">31-60</th>
              <th className="p-3 text-right">61-90</th>
              <th className="p-3 text-right">90+</th>
              <th className="p-3 text-right">Total</th>
            </tr>

          </thead>

          <tbody>

            {agingRows.map((row) => (
              <React.Fragment key={row.customerName}>

                {/* CUSTOMER ROW */}

                <tr
                  className="border-t cursor-pointer hover:bg-gray-50"
                  onClick={() =>
                    setExpandedCustomer(
                      expandedCustomer === row.customerName
                        ? null
                        : row.customerName
                    )
                  }
                >

                  <td className="p-3 font-medium">
                    {expandedCustomer === row.customerName ? "▼ " : "▶ "}
                    {row.customerName}
                  </td>

                  <td className="p-3 text-right">
                    ${row.current.toFixed(2)}
                  </td>

                  <td className="p-3 text-right">
                    ${row.d30.toFixed(2)}
                  </td>

                  <td className="p-3 text-right">
                    ${row.d60.toFixed(2)}
                  </td>

                  <td className="p-3 text-right">
                    ${row.d90.toFixed(2)}
                  </td>

                  <td className="p-3 text-right text-red-600">
                    ${row.d120.toFixed(2)}
                  </td>

                  <td className="p-3 text-right font-semibold">
                    ${row.total.toFixed(2)}
                  </td>

                </tr>

                {/* INVOICE DRILLDOWN */}

                {expandedCustomer === row.customerName && (
                  <tr>

                    <td colSpan={7} className="bg-gray-50">

                      <table className="w-full text-xs">

                        <thead className="bg-gray-200">

                          <tr>
                            <th className="p-2 text-left pl-10">
                              Factura
                            </th>

                            <th className="p-2 text-left">
                              Fecha
                            </th>

                            <th className="p-2 text-right">
                              Días
                            </th>

                            <th className="p-2 text-right">
                              Saldo
                            </th>
                          </tr>

                        </thead>

                        <tbody>

                          {(invoicesByCustomer[row.customerName] || []).map((inv) => (

                            <tr key={inv.id} className="border-t">

                              <td className="p-2 pl-10">
                                {inv.invoiceNumber}
                              </td>

                              <td className="p-2">
                                {inv.issueDate}
                              </td>

                              <td className="p-2 text-right">

                                {daysOld(inv.issueDate)}

                              </td>

                              <td className="p-2 text-right font-medium">

                                ${Number(inv.balance || 0).toFixed(2)}

                              </td>

                            </tr>

                          ))}

                        </tbody>

                      </table>

                    </td>

                  </tr>
                )}

              </React.Fragment>
            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}
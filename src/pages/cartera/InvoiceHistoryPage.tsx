// ============================================================================
// src/pages/cartera/InvoiceHistoryPage.tsx
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchJournalEntries } from "@/services/journalService";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { buildInvoiceHistory, InvoiceHistory } from "@/utils/buildInvoiceHistory";
import type { JournalEntry } from "@/types/JournalEntry";


// ===============================
// STATUS BADGE
// ===============================
function StatusBadge({ status }: { status: InvoiceHistory["status"] }) {
  const map = {
    paid: "bg-green-100 text-green-700",
    partial: "bg-yellow-100 text-yellow-700",
    pending: "bg-red-100 text-red-700",
  };

  const label = {
    paid: "Pagado",
    partial: "Parcial",
    pending: "Pendiente",
  };

  return (
    <span className={`px-2 py-1 rounded text-xs ${map[status]}`}>
      {label[status]}
    </span>
  );
}

// ===============================
// EXTRACT PAYMENTS
// ===============================
function getPayments(entries: JournalEntry[]) {
  return entries
    .filter((e) => {
      const code = e.account_code || "";
      return (
        code.startsWith("10101") || // banco
        code.startsWith("213") ||   // retenciones
        code.startsWith("133")      // IVA
      );
    })
    .map((e) => {
      const amount =
        (e.debit ?? 0) > 0
          ? e.debit ?? 0
          : e.credit ?? 0;

      let method = "Pago";

      if (e.account_code?.startsWith("10101")) method = "Banco";
      if (e.account_code?.startsWith("213")) method = "Retención";
      if (e.account_code?.startsWith("133")) method = "IVA";

      return {
        id: e.id,
        date: e.date,
        method,
        account: e.account_name,
        amount,
        reference: e.description,
      };
    });
}

// ===============================
// MAIN COMPONENT
// ===============================
export default function InvoiceHistoryPage() {
  const { selectedEntity } = useSelectedEntity();
  const location = useLocation();

  const query = new URLSearchParams(location.search);
  const type = query.get("type");

  const [data, setData] = useState<InvoiceHistory[]>([]);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [openPartner, setOpenPartner] = useState<string | null>(null);
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);
  
  const [groupBy, setGroupBy] = useState<"partner" | "date" | "due">("partner");
  const [sortBy, setSortBy] = useState<"date" | "partner" | "due">("date");
  
  // ===============================
  // LOAD REAL DATA
  // ===============================
  useEffect(() => {
    if (!selectedEntity?.id) return;

    fetchJournalEntries(selectedEntity.id).then((entries) => {
      const result = buildInvoiceHistory(entries, type);
      setData(result);
    });
  }, [selectedEntity, type]);

  // ===============================
  // SORT
  // ===============================

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      if (sortBy === "date") return a.issueDate.localeCompare(b.issueDate);
      if (sortBy === "partner") return a.partnerName.localeCompare(b.partnerName);
      if (sortBy === "due") return (a.lastPaymentDate || "").localeCompare(b.lastPaymentDate || "");
      return 0;
    });
  }, [data, sortBy]);

  // ===============================
  // GROUP
  // ===============================
  const grouped = useMemo(() => {
  const map = new Map<string, InvoiceHistory[]>();

  for (const inv of sortedData) {
    let key = "";

    if (groupBy === "partner") {
      key = inv.partnerRUC 
        ? inv.partnerRUC 
        : `NAME:${inv.partnerName}`;
    }

    if (groupBy === "date") key = inv.issueDate;
    if (groupBy === "due") key = inv.lastPaymentDate || "Sin fecha";

    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(inv);
  }

  return Array.from(map.entries()).map(([ruc, invoices]) => {
    const first = invoices[0];

    return {
      key: ruc,
      ruc: first.partnerRUC,
      name: first.partnerName,
      invoices,
      total: invoices.reduce((s, i) => s + i.total, 0),
      paid: invoices.reduce((s, i) => s + i.paid, 0),
      balance: invoices.reduce((s, i) => s + i.balance, 0),
    };
  });
}, [sortedData, groupBy]);


  // ===============================
  // UI
  // ===============================
  return (
    <div className="p-6 space-y-6">

      {/* HEADER */}
      <h1 className="text-xl font-bold">
        {type === "ar"
          ? "Historial de Cuentas por Cobrar"
          : type === "ap"
          ? "Historial de Cuentas por Pagar"
          : "Historial de Facturas"}
      </h1>

      {/* FILTER BAR */}
      <div className="flex gap-4 bg-white p-3 rounded shadow">
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as any)}
          className="px-3 py-2 border rounded"
        >
          <option value="partner">Agrupar por Proveedor</option>
          <option value="date">Agrupar por Fecha</option>
          <option value="due">Agrupar por Vencimiento</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 border rounded"
        >
          <option value="date">Ordenar por Fecha</option>
          <option value="partner">Ordenar por Proveedor</option>
          <option value="due">Ordenar por Vencimiento</option>
        </select>
      </div>

      {/* GROUPS */}
      {grouped.map((group) => {
        const isOpen = openGroup === group.key;

        return (
          <div key={group.key} className="border rounded-lg overflow-hidden">

            {/* GROUP HEADER */}
            <div
              className="bg-gray-200 px-4 py-3 flex justify-between cursor-pointer"
              onClick={() =>
                setOpenGroup(isOpen ? null : group.key)
              }
            >
              <div>
                <div className="font-semibold">{group.name}</div>
                <div className="font-semibold">{group.ruc || "SIN RUC"}</div> 
                {/* {group.ruc && (
                  <div className="text-xs text-gray-500">{group.ruc}</div>
                )}*/}
              </div>

              <div className="text-sm">
                Total: {group.total.toFixed(2)} | 
                Pagado: {group.paid.toFixed(2)} | 
                <span className="font-semibold">
                  Saldo: {group.balance.toFixed(2)}
                </span>
              </div>
            </div>

              {/* INVOICES */}
            {isOpen && (
              <div className="p-4 space-y-4">

                {group.invoices.map((inv) => {
                  const isOpenInv = openInvoice === inv.invoiceNumber;

                  const payments = getPayments(inv.entries);

                  let running = inv.total;

                  return (
                    <div key={inv.invoiceNumber} className="bg-white border rounded-lg p-4 shadow-sm">

                      {/* INVOICE HEADER */}
                      <div
                        className="flex justify-between cursor-pointer"
                        onClick={() =>
                          setOpenInvoice(
                            isOpenInv ? null : inv.invoiceNumber
                          )
                        }
                      >
                        <div className="font-semibold">
                          Factura {inv.invoiceNumber}
                        </div>

                        <div className="text-sm flex gap-3 items-center">
                          <span>Total: {inv.total.toFixed(2)}</span>
                          <span>Pagado: {inv.paid.toFixed(2)}</span>
                          <span className="font-semibold">
                            Saldo: {inv.balance.toFixed(2)}
                          </span>
                          <StatusBadge status={inv.status} />
                        </div>
                      </div>

                      {/* PAYMENTS */}
                      {isOpenInv && (
                        <div className="mt-3 border-t pt-2 text-xs space-y-2">

                          <div className="font-semibold">Pagos</div>

                          {payments.length === 0 && (
                            <div className="text-gray-500">
                              Sin pagos registrados
                            </div>
                          )}

                          {payments.map((p) => {
                            running -= p.amount;

                            return (
                              <div
                                key={p.id}
                                className="flex justify-between border-b py-1"
                              >
                                <span>
                                  {p.date} — {p.method} — {p.account}
                                </span>

                                <span className="flex gap-4">
                                  <span>${p.amount.toFixed(2)}</span>
                                  <span className="text-gray-500">
                                    Saldo: {running.toFixed(2)}
                                  </span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
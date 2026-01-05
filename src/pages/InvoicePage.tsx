import React, { useEffect, useMemo, useState } from "react";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { useAuth } from "@/context/AuthContext";

import InvoiceClientSelector from "@/components/invoices/InvoiceClientSelector";
import InvoiceItemsTable from "@/components/invoices/InvoiceItemsTable";

import type { Contact } from "@/types/Contact";
import type {
  Invoice,
  InvoiceSri,
  InvoiceItem,
  InvoiceTotals,
  TaxRate,
} from "@/types/Invoice";

import { fetchClientContacts } from "@/services/contactService";
import {
  createInvoice,
  issueInvoice,
  cancelInvoice,
  sendInvoiceToSri,
} from "@/services/invoiceService";

/* =============================
 Helpers
============================= */
function round2(n: number) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
const money = (v?: number) => round2(v ?? 0);

function normalizeIdentificationType(
  type?: Contact["identificationType"]
): "ruc" | "cedula" | "pasaporte" {
  if (type === "pasaporte") return "pasaporte";
  if (type === "cedula" || type === "consumidor_final") return "cedula";
  return "ruc";
}

/**
 * Guarantees a valid InvoiceSri object
 * This enforces the Invoice invariant required by TypeScript
 */
function ensureSri(prev: Invoice): InvoiceSri {
  return (
    prev.sri ?? {
      ambiente: "1",
      estab: "001",
      ptoEmi: "001",
      secuencial: "000000001",
    }
  );
}


function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-700">{label}</span>
      <span className="font-semibold tabular-nums">
        ${round2(value).toFixed(2)}
      </span>
    </div>
  );
}

/* =============================
 Component
============================= */
export default function InvoicePage() {
  const { selectedEntity } = useSelectedEntity();
  const { user } = useAuth();

  const entityId = useMemo(
    () => selectedEntity?.id ?? "",
    [selectedEntity]
  );

  const [clients, setClients] = useState<Contact[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  const [selectedClient, setSelectedClient] = useState<Contact | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);

  const [issueDate, setIssueDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState("");

  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [signing, setSigning] = useState(false);

  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);

  const [showSignModal, setShowSignModal] = useState(false);
  const [p12Password, setP12Password] = useState("");

  /* =============================
   Load clients
  ============================= */
  useEffect(() => {
    if (!entityId) return;

    (async () => {
      setLoadingClients(true);
      try {
        const list = await fetchClientContacts(entityId);
        setClients(list);
      } finally {
        setLoadingClients(false);
      }
    })();
  }, [entityId]);

  /* =============================
   Totals (SRI format)
  ============================= */
  const totalsPreview = useMemo(() => {
    const validItems = items.filter(
      (i) => i.description?.trim().length
    );

    const subtotalsByRate: Record<TaxRate, number> = {
      0: 0,
      12: 0,
      15: 0,
    };

    const ivaByRate: Record<12 | 15, number> = {
      12: 0,
      15: 0,
    };

    let subtotalSinImpuestos = 0;
    let discountTotal = 0;

    for (const it of validItems) {
      const rate = (Number(it.ivaRate) || 0) as TaxRate;
      const base = round2(Number(it.subtotal) || 0);
      const iva = round2(Number(it.ivaValue) || 0);

      subtotalsByRate[rate] += base;
      subtotalSinImpuestos += base;

      if (rate === 12 || rate === 15) {
        ivaByRate[rate] += iva;
      }

      discountTotal += Number(it.discount) || 0;
    }

    const total = round2(
      subtotalSinImpuestos + ivaByRate[12] + ivaByRate[15]
    );

    const totals: InvoiceTotals = {
      subtotalsByRate,
      subtotalNoObjetoIVA: 0,
      subtotalExentoIVA: 0,
      subtotalSinImpuestos,
      discountTotal,
      ice: 0,
      ivaByRate,
      irbpnr: 0,
      propina: 0,
      total,
    };

    return { validItems, totals };
  }, [items]);

  /* =============================
   Save Draft
  ============================= */
  async function handleSaveInvoice() {
    if (saving || processing || signing) return;
    if (!entityId) return alert("Selecciona una empresa.");
    if (!user?.uid) return alert("Usuario no autenticado.");
    if (!selectedClient) return alert("Selecciona un cliente.");
    if (!issueDate) return alert("Selecciona la fecha.");
    if (!totalsPreview.validItems.length) {
      return alert("Agrega al menos un ítem válido.");
    }

    const customer: Invoice["customer"] = {
      contactId: selectedClient.id!,
      identificationType: normalizeIdentificationType(
        selectedClient.identificationType
      ),
      identification:
        selectedClient.identificationType === "consumidor_final"
          ? "9999999999999"
          : selectedClient.identification ?? "",
      name:
        selectedClient.identificationType === "consumidor_final"
          ? "CONSUMIDOR FINAL"
          : selectedClient.name ?? "",
      email: selectedClient.email,
      address: selectedClient.address,
      phone: selectedClient.phone,
    };

    try {
      setSaving(true);

      const created = await createInvoice(entityId, user.uid, {
        type: "FACTURA",
        issueDate,
        dueDate: dueDate || undefined,
        customer,
        currency: "USD",
        items: totalsPreview.validItems,
        totals: totalsPreview.totals,
        note: "",
      });

      setCurrentInvoice(created);
      alert(`✅ Factura guardada (BORRADOR)\nID: ${created.id}`);
    } catch (e) {
      console.error(e);
      alert("❌ No se pudo grabar la factura.");
    } finally {
      setSaving(false);
    }
  }

  /* =============================
   Emitir → pending-sign
  ============================= */
  async function handleIssue() {
    if (processing || signing) return;
    if (!entityId || !currentInvoice?.id) return;
    if (currentInvoice.status !== "draft") {
      return alert("Solo se puede emitir desde BORRADOR.");
    }

    if (!confirm("¿Emitir factura?")) return;

    try {
      setProcessing(true);
      await issueInvoice(entityId, currentInvoice.id);

      setCurrentInvoice((prev) =>
        prev ? { ...prev, status: "pending-sign" } : prev
      );

      alert("✅ Factura en estado PENDING-SIGN.");
    } catch (e) {
      console.error(e);
      alert("❌ No se pudo emitir.");
    } finally {
      setProcessing(false);
    }
  }

  /* =============================
   Firmar factura
  ============================= */
  async function handleSignInvoice() {
    if (!entityId || !currentInvoice?.id) return;
    if (!p12Password) 
      return alert("Ingresa la contraseña del certificado P12");
      
    try {
      setSigning(true);

      const res = await fetch("/.netlify/functions/sign-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          invoiceId: currentInvoice.id,
          p12Password,
        }),
      });

      const data = JSON.parse(await res.text());
      if (!res.ok) throw new Error(data?.error || "Error firmando factura.");

      setCurrentInvoice((prev) =>
        prev ? { ...prev, status: "signed" } : prev
      );

      setShowSignModal(false);
      setP12Password("");
      alert("✅ Factura firmada correctamente.");
    } catch (e: any) {
      console.error(e);
      alert(`❌ Error al firmar: ${e.message}`);
    } finally {
      setSigning(false);
    }
  }

  /* =============================
   Enviar al SRI
  ============================= */
  async function handleSendToSri() {
    if (processing || signing) return;
    if (!entityId || !currentInvoice?.id) return;

    if (currentInvoice.status !== "signed") return alert("La factura debe estar firmada antes de enviarse al SRI.");

    if (!confirm("¿Enviar esta factura al SRI?")) return;

    try {
      setProcessing(true);

      const res = await sendInvoiceToSri(entityId, currentInvoice.id);

      setCurrentInvoice((prev) => {
        if (!prev) return prev;

        const baseSri = ensureSri(prev);

        return {
          ...prev,
          status: "sent-sri",
          sri: {
            ambiente: baseSri.ambiente,
            estab: baseSri.estab,
            ptoEmi: baseSri.ptoEmi,
            secuencial: baseSri.secuencial,
            claveAcceso: res.claveAcceso,
            recepcion: res,
          },
        };
      });

      alert("✅ Factura enviada al SRI (Recepción).");
    } catch (e) {
      console.error(e);
      alert("❌ Error enviando al SRI.");
    } finally {
      setProcessing(false);
    }
  }

  /* =============================
   Cancelar (draft only)
  ============================= */
  async function handleCancel() {
    if (processing || signing) return;
    if (!entityId || !currentInvoice?.id) return;

    if (currentInvoice.status !== "draft") return alert("Solo se puede anular en BORRADOR.");
    
    const reason = prompt("Motivo de anulación:");
    if (!reason) return;

    try {
      setProcessing(true);
      await cancelInvoice(entityId, currentInvoice.id, reason);
      setCurrentInvoice({ ...currentInvoice, status: "cancelled" });
      alert("⚠️ Factura anulada.");
    } catch (e) {
      console.error(e);
      alert("❌ No se pudo anular.");
    } finally {
      setProcessing(false);
    }
  }

  /* =============================
   Reset form
  ============================= */
  function resetForm() {
    if (processing || signing) return;
    if (currentInvoice && currentInvoice.status !== "draft") return;

    setItems([]);
    setSelectedClient(null);
    setIssueDate(new Date().toISOString().slice(0, 10));
    setDueDate("");
    setCurrentInvoice(null);
  }

  /* =============================
   Render
  ============================= */
   return (
    <div className="w-full px-4 py-4 pb-24 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[#0A3558] mb-2">
        Facturación Electrónica
      </h1>
      <p className="text-gray-600 mb-6">
        Emisión de facturas conforme normativa SRI.
      </p>

      {currentInvoice && (
        <div className="text-sm text-gray-500 mb-6 flex gap-3">
          <span>
          Factura ID: <strong>{currentInvoice.id}</strong>
          </span>
          <span>
            Estado: <strong>{currentInvoice.status.toUpperCase()}</strong>
          </span>
        </div>
      )}

      {/* CLIENT */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Cliente</h2>
        <InvoiceClientSelector
          clients={clients}
          loading={loadingClients}
          value={selectedClient}
          onChange={setSelectedClient}
          disabled={!!currentInvoice}
        />
      </div>

      {/* DATES */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Fechas</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            disabled={!!currentInvoice}
          />
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={!!currentInvoice}
          />
        </div>
      </div>

      {/* ITEMS */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <InvoiceItemsTable
          items={items}
          onChange={currentInvoice ? () => {} : setItems}
        />
      </div>

      {/* TOTALS */}
      <div className="flex justify-end mb-6">
        <div className="w-full md:w-[420px] border rounded-xl p-4 text-sm space-y-1 bg-white shadow">
          <div className="font-semibold mb-2">
            RESUMEN FACTURA — FORMATO SRI
          </div>

          <Row label="SUBTOTAL 15%" value={money(totalsPreview.totals.subtotalsByRate[15])} />
          <Row label="SUBTOTAL 12%" value={money(totalsPreview.totals.subtotalsByRate[12])} />
          <Row label="SUBTOTAL 0%" value={money(totalsPreview.totals.subtotalsByRate[0])} />
          <Row label="SUBTOTAL SIN IMPUESTOS" value={money(totalsPreview.totals.subtotalSinImpuestos)} />
          <Row label="IVA 15%" value={money(totalsPreview.totals.ivaByRate[15])} />
          <Row label="IVA 12%" value={money(totalsPreview.totals.ivaByRate[12])} />

          <hr className="my-2" />

          <div className="flex justify-between font-bold text-lg">
            <span>VALOR TOTAL</span>
            <span>${totalsPreview.totals.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex justify-end gap-3">
        <button onClick={resetForm} className="px-4 py-2 bg-gray-200 rounded">
          Cancelar
        </button>

        {!currentInvoice && (
          <button
            onClick={handleSaveInvoice}
            disabled={saving || processing || signing}
            className="px-4 py-2 bg-[#0A3558] text-white rounded"
          >
            Guardar Borrador
          </button>
        )}

        {currentInvoice?.status === "draft" && (
          <button
            onClick={handleIssue}
            disabled={processing || signing}
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            Emitir
          </button>
        )}

        {currentInvoice?.status === "pending-sign" && (
          <button
            onClick={() => setShowSignModal(true)}
            disabled={processing || signing}
            className="px-4 py-2 bg-purple-700 text-white rounded"
          >
            Firmar factura
          </button>
        )}

        {currentInvoice?.status === "signed" && (
          <button
            onClick={handleSendToSri}
            disabled={processing || signing}
            className="px-4 py-2 bg-indigo-700 text-white rounded"
          >
            Enviar al SRI
          </button>
        )}

        {currentInvoice?.status === "draft" && (
          <button
            onClick={handleCancel}
            disabled={processing || signing}
            className="px-4 py-2 bg-red-600 text-white rounded"
          >
            Anular
          </button>
        )}
        {showSignModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold mb-4">
                Firmar factura electrónica
              </h3>

              <p className="text-sm text-gray-600 mb-4">
                Ingresa la contraseña del certificado digital (P12).
                <br />
                <strong>No se guardará.</strong>
              </p>

              <input
                type="password"
                className="border rounded px-3 py-2 w-full mb-4"
                placeholder="Contraseña del certificado"
                value={p12Password}
                onChange={(e) => setP12Password(e.target.value)}
              />

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    if (signing) return;
                    setShowSignModal(false);
                    setP12Password("");
                  }}
                  className="px-4 py-2 bg-gray-200 rounded"
                  disabled={signing}
                >
                  Cancelar
                </button>

                <button
                  onClick={handleSignInvoice}
                  disabled={signing}
                  className="px-4 py-2 bg-purple-700 text-white rounded disabled:opacity-50"
                >
                  {signing ? "Firmando..." : "Firmar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
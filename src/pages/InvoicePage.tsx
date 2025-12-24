// src/pages/InvoicePage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useSelectedEntity } from "@/context/SelectedEntityContext";

import InvoiceClientSelector from "@/components/invoices/InvoiceClientSelector";
import InvoiceItemsTable from "@/components/invoices/InvoiceItemsTable";

import type { Contact } from "@/types/Contact";
import type { Invoice } from "@/types/Invoice";
import type { InvoiceItem } from "@/types/InvoiceItem";
import type { InvoiceContactSnapshot } from "@/types/Invoice";

import { fetchClientContacts } from "@/services/contactService";
import {
  createInvoice,
  issueInvoice,
  cancelInvoice,
} from "@/services/invoiceService";

export default function InvoicePage() {
  const { selectedEntity } = useSelectedEntity();
  const entityId = selectedEntity?.id ?? "";

  const [clients, setClients] = useState<Contact[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  const [selectedClient, setSelectedClient] = useState<Contact | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);

  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [invoiceType, setInvoiceType] =
    useState<Invoice["invoiceType"]>("invoice");

  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Para poder EMITIR / ANULAR inmediatamente el borrador guardado
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);

  /* ==============================
      LOAD CLIENT LIST
  ============================== */
  useEffect(() => {
    if (!entityId) return;

    const load = async () => {
      setLoadingClients(true);
      try {
        const list = await fetchClientContacts(entityId);
        setClients(list);
      } finally {
        setLoadingClients(false);
      }
    };

    load();
  }, [entityId]);

  /* ==============================
      Totales en pantalla (memo)
  ============================== */
  const totalsPreview = useMemo(() => {
    const validItems = items.filter((i) => i.description?.trim().length > 0);

    const subtotal0 = validItems
      .filter((i) => (i.ivaRate ?? 0) === 0)
      .reduce((sum, i) => sum + (i.subtotal ?? 0), 0);

    const subtotal12 = validItems
      .filter((i) => (i.ivaRate ?? 0) > 0)
      .reduce((sum, i) => sum + (i.subtotal ?? 0), 0);

    const iva = validItems.reduce((sum, i) => sum + (i.ivaValue ?? 0), 0);
    const total = subtotal0 + subtotal12 + iva;

    return { subtotal0, subtotal12, iva, total, validItems };
  }, [items]);

  /* ==============================
      SAVE INVOICE (DRAFT)
  ============================== */
  const handleSaveInvoice = async () => {
    if (!entityId) return alert("Selecciona una empresa.");
    if (!selectedClient) return alert("Selecciona un cliente.");
    if (!issueDate) return alert("Selecciona la fecha de la factura.");

    const validItems = totalsPreview.validItems;
    if (validItems.length === 0) return alert("Agrega al menos un ítem válido.");

    // ✅ Snapshot del contacto (sin undefined para Firestore)
    const snapshot: InvoiceContactSnapshot = {
      name: selectedClient.name ?? "",
      identification: selectedClient.identification ?? "",
      identificationType: selectedClient.identificationType ?? "ruc",
      email: selectedClient.email ?? "",
      address: selectedClient.address ?? "",
      phone: selectedClient.phone || undefined, // si viene vacío, mejor undefined
    };

    // ✅ Totales correctos
    const { subtotal0, subtotal12, iva, total } = totalsPreview;

    try {
      setSaving(true);

      const created = await createInvoice(entityId, {
        invoiceType,
        issueDate,
        dueDate: dueDate || undefined,

        contactId: selectedClient.id,
        contactSnapshot: snapshot,

        currency: "USD",
        items: validItems,

        totals: {
          subtotal0,
          subtotal12,
          descuento: 0,
          iva,
          total,
        },
      });

      setCurrentInvoice(created);

      alert(`✅ Factura guardada (BORRADOR)\nID: ${created.id}`);
    } catch (err) {
      console.error(err);
      alert("❌ No se pudo grabar la factura.");
    } finally {
      setSaving(false);
    }
  };

  /* ==============================
      ISSUE / CANCEL (sobre currentInvoice)
  ============================== */
  async function handleIssue() {
    if (!currentInvoice) return;
    if (processing || currentInvoice.status !== "draft") return;

    const ok = confirm("¿Deseas EMITIR esta factura?\nEsta acción no se puede deshacer.");
    if (!ok) return;

    try {
      setProcessing(true);
      await issueInvoice(currentInvoice.entityId, currentInvoice.id);
      setCurrentInvoice({ ...currentInvoice, status: "issued" });
      alert("✅ Factura emitida correctamente.");
    } catch (e) {
      console.error(e);
      alert("❌ No se pudo emitir la factura.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleCancel() {
    if (!currentInvoice) return;
    if (processing || currentInvoice.status !== "draft") return;

    const reason = prompt("Motivo de anulación:");
    if (!reason) return;

    try {
      setProcessing(true);
      await cancelInvoice(currentInvoice.entityId, currentInvoice.id, reason);
      setCurrentInvoice({ ...currentInvoice, status: "cancelled" });
      alert("⚠️ Factura anulada.");
    } catch (e) {
      console.error(e);
      alert("❌ No se pudo anular la factura.");
    } finally {
      setProcessing(false);
    }
  }

  const resetForm = () => {
    setItems([]);
    setSelectedClient(null);
    setIssueDate("");
    setDueDate("");
    setInvoiceType("invoice");
    setCurrentInvoice(null);
  };

  /* ==============================
      RENDER
  ============================== */
  return (
    <div className="w-full px-4 py-4 pb-24 md:pb-6 md:px-6 md:py-6 max-w-6xl mx-auto">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0A3558]">Facturación Electrónica</h1>
        <p className="text-gray-600">Emisión de facturas conforme normativa SRI.</p>
      </div>

      {/* CLIENT */}
      <div className="bg-white rounded-xl shadow p-4 md:p-6 mb-4 md:mb-6">
        <h2 className="text-lg font-semibold mb-4">Información del Cliente</h2>

        <InvoiceClientSelector
          clients={clients}
          loading={loadingClients}
          value={selectedClient}
          onChange={setSelectedClient}
        />

        {selectedClient && (
          <div className="mt-4 p-4 bg-gray-50 border rounded text-sm">
            <p><strong>Nombre:</strong> {selectedClient.name}</p>
            <p><strong>ID:</strong> {selectedClient.identification}</p>
            <p><strong>Email:</strong> {selectedClient.email || "—"}</p>
            <p><strong>Dirección:</strong> {selectedClient.address || "—"}</p>
            <p><strong>Teléfono:</strong> {selectedClient.phone || "—"}</p>
          </div>
        )}
      </div>

      {/* DETAILS */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Detalles de la Factura</h2>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
          <div>
            <label className="text-sm text-gray-600">Fecha de Factura</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2 mt-1"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Fecha de Vencimiento</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2 mt-1"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Tipo</label>
            <select
              className="w-full border rounded px-3 py-2 mt-1"
              value={invoiceType}
              onChange={(e) => setInvoiceType(e.target.value as Invoice["invoiceType"])}
            >
              <option value="invoice">Factura</option>
              <option value="credit-note">Nota de Crédito</option>
              <option value="retention">Retención</option>
            </select>
          </div>
        </div>
      </div>

      {/* ITEMS */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Ítems</h2>
        <InvoiceItemsTable items={items} onChange={setItems} />

        {/* Totales visibles (si tu tabla no los muestra, aquí quedan siempre correctos) */}
        <div className="mt-3 border rounded-lg p-3 md:p-4 bg-gray-50 text-sm">
          <div className="flex justify-between py-1">
            <span>Subtotal 0%:</span>
            <span>${totalsPreview.subtotal0.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span>Subtotal 12%:</span>
            <span>${totalsPreview.subtotal12.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span>IVA:</span>
            <span>${totalsPreview.iva.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1 font-semibold text-lg md:text-base text-[#0A3558]">
            <span>Total:</span>
            <span>${totalsPreview.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* CURRENT INVOICE STATUS + ACTIONS */}
      {currentInvoice && (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="font-semibold">Borrador actual:</p>
              <p className="text-sm text-gray-600">
                ID: <span className="font-mono">{currentInvoice.id}</span> — Estado:{" "}
                <span className="font-semibold">{currentInvoice.status}</span>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50"
                disabled={processing || currentInvoice.status !== "draft"}
                onClick={handleIssue}
                type="button"
              >
                {processing ? "Procesando..." : "Emitir"}
              </button>

              <button
                className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-50"
                disabled={processing || currentInvoice.status !== "draft"}
                onClick={handleCancel}
                type="button"
              >
                {processing ? "Procesando..." : "Anular"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER ACTIONS */}
      {/* FOOTER ACTIONS */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex gap-3 md:static md:border-0 md:p-0 md:justify-end">
        <button
          className="flex-1 md:flex-none px-4 py-3 md:py-2 bg-gray-200 rounded"
          onClick={resetForm}
          type="button"
        >
          Cancelar
        </button>

        <button
          className="flex-1 md:flex-none px-4 py-3 md:py-2 bg-[#0A3558] text-white rounded disabled:opacity-50"
          disabled={saving}
          onClick={handleSaveInvoice}
          type="button"
        >
          {saving ? "Grabando..." : "Guardar Borrador"}
        </button>
      </div>
    </div>
  );
}
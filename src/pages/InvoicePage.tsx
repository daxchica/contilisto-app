// src/pages/InvoicePage.tsx
import React, { useState, useEffect } from "react";
import { useSelectedEntity } from "@/context/SelectedEntityContext";

import InvoiceClientSelector from "@/components/invoice/InvoiceClientSelector";
import InvoiceItemsTable from "@/components/invoice/InvoiceItemsTable";

import { Client, fetchClients } from "@/services/clientService";
import { createInvoice } from "@/services/invoiceService";

import type { InvoiceItem } from "@/types/InvoiceItem";
import type { Invoice } from "@/types/Invoice";

export default function InvoicePage() {
  const { selectedEntity } = useSelectedEntity();
  const entityId = selectedEntity?.id ?? "";

  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);

  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [invoiceType, setInvoiceType] =
    useState<Invoice["invoiceType"]>("invoice");

  const [saving, setSaving] = useState(false);

  /* ==============================
      LOAD CLIENT LIST
  ============================== */
  const loadClients = async () => {
    if (!entityId) return;
    setLoadingClients(true);
    const clientList = await fetchClients(entityId);
    setClients(clientList);
    setLoadingClients(false);
  };

  useEffect(() => {
    loadClients();
  }, [entityId]);

  /* ==============================
      SAVE INVOICE (Grabar Factura)
  ============================== */
  const handleSaveInvoice = async () => {
    if (!entityId) {
      alert("Selecciona una empresa.");
      return;
    }

    if (!selectedClient) {
      alert("Selecciona un cliente.");
      return;
    }

    if (!issueDate) {
      alert("Selecciona la fecha de la factura.");
      return;
    }

    if (items.length === 0) {
      alert("Agrega al menos un ítem facturado.");
      return;
    }

    // Totales desde los items
    const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
    const iva = items.reduce((sum, i) => sum + i.ivaValue, 0);
    const total = items.reduce((sum, i) => sum + i.total, 0);

    const sriXml = "";

    try {
      setSaving(true);

      const created = await createInvoice(entityId, {
        clientId: selectedClient.id,
        clientName: selectedClient.razon_social,
        issueDate,
        dueDate: dueDate || undefined,
        invoiceType,
        items,
        subtotal,
        iva,
        total,
        sriXml,
      });

      console.log("✅ Invoice created:", created);
      alert(`Factura grabada correctamente. ID: ${created.id}`);

      // Reset form
      setItems([]);
      setSelectedClient(null);
      setIssueDate("");
      setDueDate("");
      setInvoiceType("invoice");

    } catch (err) {
      console.error("❌ Error creating invoice:", err);
      alert("No se pudo grabar la factura. Revisa la consola.");
    } finally {
      setSaving(false);
    }
  };

  /* ==============================
      RENDER
  ============================== */
  return (
    <div className="w-full px-8 py-6">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0A3558]">
          Facturación Electrónica
        </h1>
        <p className="text-gray-600">
          Emisión de Facturas Electrónicas en cumplimiento con la normativa del
          SRI.
        </p>
      </div>

      {/* CLIENT SELECTOR SECTION */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Información del Cliente</h2>

        <InvoiceClientSelector
          clients={clients}
          loading={loadingClients}
          value={selectedClient}
          onChange={(client) => setSelectedClient(client)}
        />

        {selectedClient && (
          <div className="mt-4 p-4 bg-gray-50 border rounded-lg text-sm text-gray-700">
            <p>
              <strong>Nombre:</strong> {selectedClient.razon_social}
            </p>
            <p>
              <strong>ID:</strong> {selectedClient.identificacion}
            </p>
            <p>
              <strong>Email:</strong> {selectedClient.email || "N/A"}
            </p>
            <p>
              <strong>Teléfono:</strong> {selectedClient.telefono || "N/A"}
            </p>
          </div>
        )}
      </div>

      {/* INVOICE DETAILS */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Detalles de la Factura</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-600">Fecha de la Factura</label>
            <input
              type="date"
              className="w-full border rounded-lg px-3 py-2 mt-1"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">
              Fecha de Vencimiento
            </label>
            <input
              type="date"
              className="w-full border rounded-lg px-3 py-2 mt-1"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Tipo de Factura</label>
            <select
              className="w-full border rounded-lg px-3 py-2 mt-1"
              value={invoiceType}
              onChange={(e) =>
                setInvoiceType(e.target.value as Invoice["invoiceType"])
              }
            >
              <option value="invoice">Factura</option>
              <option value="credit-note">Nota de Crédito</option>
              <option value="retention">Retención</option>
            </select>
          </div>
        </div>
      </div>

      {/* ITEMS TABLE */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Items Facturados</h2>
        <InvoiceItemsTable items={items} onChange={setItems} />
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex justify-end gap-3">
        <button
          className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          type="button"
          onClick={() => {
            setItems([]);
            setSelectedClient(null);
            setIssueDate("");
            setDueDate("");
            setInvoiceType("invoice");
          }}
        >
          Cancelar
        </button>
        <button
          className="px-4 py-2 bg-[#0A3558] text-white rounded-lg hover:bg-[#0c426f]"
          type="button"
          disabled={saving}
          onClick={handleSaveInvoice}
        >
          {saving ? "Grabando..." : "Grabar Factura"}
        </button>
      </div>
    </div>
  );
}
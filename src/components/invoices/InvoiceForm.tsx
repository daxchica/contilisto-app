// src/components/invoices/InvoiceForm.tsx
import React, { useEffect, useMemo, useState } from "react";
import { createInvoice } from "@/services/invoiceService";
import type { Contact } from "@/types/Contact";
import type { Invoice, IdentificationType } from "@/types/Invoice";
import type { InvoiceItem } from "@/types/InvoiceItem";

type Props = {
  entityId: string;
  contacts: Contact[]; // contactos con rol cliente o ambos
  onSaved?: (invoice: Invoice) => void;
};

const IVA_RATE = 0.12;

function round2(n: number) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
function money(n: number) {
  return round2(n).toFixed(2);
}

function safeIdType(v: unknown): IdentificationType {
  if (v === "cedula" || v === "ruc" || v === "pasaporte" || v === "consumidor_final") return v;
  return "cedula";
}

function computeLine(quantity: number, unitPrice: number, ivaRate: number) {
  const q = Number.isFinite(quantity) ? quantity : 0;
  const p = Number.isFinite(unitPrice) ? unitPrice : 0;
  const rate = Number.isFinite(ivaRate) ? ivaRate : 0;

  const subtotal = round2(q * p);
  const ivaValue = round2(subtotal * rate);
  const total = round2(subtotal + ivaValue);

  return { subtotal, ivaValue, total };
}

function makeId() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = globalThis.crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {}
  return `it_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function emptyItem(): InvoiceItem {
  const base = computeLine(1, 0, IVA_RATE);
  return {
    id: makeId(),
    description: "",
    quantity: 1,
    unitPrice: 0,
    ivaRate: IVA_RATE,
    subtotal: base.subtotal,
    ivaValue: base.ivaValue,
    total: base.total,
  };
}

export default function InvoiceForm({ entityId, contacts, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Header
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));

  // ✅ Se mantiene para UI, pero NO se envía en el payload (tu Invoice no lo tiene)
  const [sequential, setSequential] = useState("");

  const [contactId, setContactId] = useState<string>("");

  // Items
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);

  useEffect(() => {
    if (!contactId && contacts.length === 1) setContactId(contacts[0].id);
  }, [contacts, contactId]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === contactId) ?? null,
    [contacts, contactId]
  );

  function normalizeItem(it: InvoiceItem): InvoiceItem {
    const line = computeLine(
      Number(it.quantity) || 0,
      Number(it.unitPrice) || 0,
      Number(it.ivaRate) || 0
    );
    return { ...it, ...line };
  }

  function updateItem(id: string, patch: Partial<InvoiceItem>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? normalizeItem({ ...it, ...patch }) : it))
    );
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== id);
      return next.length ? next : [emptyItem()];
    });
  }

  const totals = useMemo(() => {
    const nonEmpty = items.filter((it) => (it.description ?? "").trim().length > 0);

    let subtotal0 = 0;
    let subtotal12 = 0;
    let iva = 0;

    for (const it of nonEmpty) {
      const rate = Number(it.ivaRate ?? 0) || 0;
      const lineSubtotal = Number(it.subtotal ?? 0) || 0;
      const lineIva = Number(it.ivaValue ?? 0) || 0;

      if (rate > 0) subtotal12 += lineSubtotal;
      else subtotal0 += lineSubtotal;

      iva += lineIva;
    }

    subtotal0 = round2(subtotal0);
    subtotal12 = round2(subtotal12);
    iva = round2(iva);

    const descuento = 0;
    const total = round2(subtotal0 + subtotal12 - descuento + iva);

    return {
      subtotal0,
      subtotal12,
      descuento,
      iva,
      total,
      taxes: [
        ...(subtotal12 > 0
          ? [
              {
                code: "iva" as const,
                rate: 12 as const,
                base: subtotal12,
                amount: iva,
              },
            ]
          : []),
      ],
    };
  }, [items]);

  function validate(): string | null {
    if (!entityId) return "Empresa no válida. Selecciona una empresa.";
    if (!issueDate) return "Selecciona la fecha de emisión.";
    if (!selectedContact) return "Selecciona un cliente.";

    // En tu Contact.ts email y address son obligatorios (SRI)
    if (!selectedContact.email?.trim()) 
        return "El contacto no tiene email. (Obligatorio SRI)";

    if (!selectedContact.address?.trim()) 
        return "El contacto no tiene dirección. (Obligatorio SRI)";

    const nonEmptyItems = items.filter(
        (it) => it.description.trim().length > 0
    );
    
    if (nonEmptyItems.length === 0)
        return "Agrega al menos un item";
    return "Agrega al menos un ítem con descripción.";

  return null;
}

  async function handleSaveDraft() {
    if (loading) return;

    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const normalizedItems = items
        .filter((it) => (it.description ?? "").trim().length > 0)
        .map((it) =>
          normalizeItem({
            ...it,
            quantity: Number(it.quantity) || 0,
            unitPrice: Number(it.unitPrice) || 0,
            ivaRate: Number(it.ivaRate ?? 0) || 0,
          })
        );

      const c = selectedContact!;

      const snapshot = {
        name: c.name,
        identification: c.identification,
        identificationType: safeIdType(c.identificationType),
        email: c.email,
        phone: c.phone ?? "",
        address: c.address,
      };

      // ✅ IMPORTANTE:
      // No enviamos "sequential" porque tu tipo Invoice NO lo incluye.
      // Si quieres guardarlo, debes agregarlo al type Invoice y al servicio.
      const payload: Omit<
        Invoice, 
        "id" | "entityId" | "createdAt" | "createdBy" | "status"
      > = {
        invoiceType: "invoice",
        issueDate,
        sequential: sequential.trim() || undefined,
        contactId: c.id,
        contactSnapshot: snapshot,
        currency: "USD",
        items: normalizedItems,
        totals,
      };

      const created = await createInvoice(entityId, payload);
      onSaved?.(created);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "No se pudo guardar la factura.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Nueva Factura</h2>
          <p className="text-sm text-gray-500">La factura se guardará como borrador.</p>
        </div>

        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={loading}
          className="px-6 py-3 rounded-xl bg-blue-700 text-white font-semibold hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Guardar borrador"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 text-red-700 p-3 text-sm border">
          {error}
        </div>
      )}

      {/* Top fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-sm">
          <span className="block text-gray-600 font-medium mb-1">Fecha de emisión</span>
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="block text-gray-600 font-medium mb-1">Secuencial (opcional)</span>
          <input
            type="text"
            value={sequential}
            onChange={(e) => setSequential(e.target.value)}
            placeholder="001-001-000000123"
            className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="block mt-1 text-xs text-gray-500">
            Puedes dejarlo vacío mientras sea borrador (se asignará en fase SRI).
          </span>
        </label>
      </div>

      {/* Contact */}
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm">
          <span className="font-medium text-gray-600">Cliente</span>
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="mt-1 w-full px-4 py-3 rounded-xl border bg-white"
          >
            <option value="">Selecciona un cliente…</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || "Sin nombre"} — {c.identification || "Sin ID"}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-xl bg-gray-50 border p-4 text-sm">
          <p className="font-semibold text-gray-800">Datos del contacto</p>
          <p>Email: {selectedContact?.email ?? "—"}</p>
          <p>Teléfono: {selectedContact?.phone ?? "—"}</p>
          <p>Dirección: {selectedContact?.address ?? "—"}</p>
        </div>
      </div>

      {/* Items */}
      <div className="rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
          <p className="font-semibold text-gray-800">Ítems</p>
          <button
            type="button"
            onClick={addItem}
            className="px-3 py-2 rounded-lg bg-white border text-sm font-semibold hover:bg-gray-50"
          >
            + Agregar ítem
          </button>
        </div>

        <div className="divide-y">
          {items.map((it) => (
            <div key={it.id} className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5">
                <label className="text-xs text-gray-500 font-medium">Descripción</label>
                <input
                  value={it.description}
                  onChange={(e) => updateItem(it.id, { description: e.target.value })}
                  placeholder="Producto/Servicio"
                  className="mt-1 w-full px-3 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs text-gray-500 font-medium">Cantidad</label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={it.quantity}
                  onChange={(e) => updateItem(it.id, { quantity: Number(e.target.value) })}
                  className="mt-1 w-full px-3 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs text-gray-500 font-medium">Precio</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={it.unitPrice}
                  onChange={(e) => updateItem(it.id, { unitPrice: Number(e.target.value) })}
                  className="mt-1 w-full px-3 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs text-gray-500 font-medium">IVA</label>
                <select
                  value={String(it.ivaRate ?? 0)}
                  onChange={(e) => updateItem(it.id, { ivaRate: Number(e.target.value) })}
                  className="mt-1 w-full px-3 py-3 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="0">0%</option>
                  <option value={String(IVA_RATE)}>12%</option>
                </select>
              </div>

              <div className="sm:col-span-1 flex sm:items-end">
                <button
                  type="button"
                  onClick={() => removeItem(it.id)}
                  className="w-full sm:w-auto mt-5 sm:mt-0 px-3 py-3 rounded-xl border text-red-600 font-semibold hover:bg-red-50"
                  aria-label="Eliminar ítem"
                >
                  🗑️
                </button>
              </div>

              <div className="sm:col-span-12 text-xs text-gray-500">
                Subtotal: ${money(it.subtotal)} · IVA: ${money(it.ivaValue)} · Total: ${money(it.total)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="rounded-2xl border bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Subtotal 0%</span>
          <span className="font-semibold text-gray-900">${money(totals.subtotal0)}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-gray-600">Subtotal 12%</span>
          <span className="font-semibold text-gray-900">${money(totals.subtotal12)}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-gray-600">Descuento</span>
          <span className="font-semibold text-gray-900">${money(totals.descuento)}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-gray-600">IVA</span>
          <span className="font-semibold text-gray-900">${money(totals.iva)}</span>
        </div>
        <div className="h-px bg-gray-200 my-3" />
        <div className="flex items-center justify-between">
          <span className="text-gray-900 font-semibold">Total</span>
          <span className="text-xl font-extrabold text-gray-900">${money(totals.total)}</span>
        </div>
      </div>
    </div>
  );
}
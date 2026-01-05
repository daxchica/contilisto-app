// src/components/invoices/InvoiceForm.tsx
import React, { useMemo, useState } from "react";
import { getAuth } from "firebase/auth";

import InvoiceItemsTable from "@/components/invoices/InvoiceItemsTable";

import type { InvoiceItem, InvoiceTotals, TaxRate } from "@/types/Invoice";
import type { Contact } from "@/types/Contact";
import type { CreateInvoiceInput } from "@/services/invoiceService";
import { createInvoice } from "@/services/invoiceService";

/* ---------------------------------------------------
 Helpers
--------------------------------------------------- */
const round2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const asNum = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const money = (v: number) => round2(v).toFixed(2);

// Always return a number (never undefined) -> avoids TS + Firestore issues
const nz = (v?: number) => round2(v ?? 0);

function normalizeIdType(t?: Contact["identificationType"]): "ruc" | "cedula" | "pasaporte" {
  if (t === "pasaporte") return "pasaporte";
  if (t === "cedula" || t === "consumidor_final") return "cedula";
  return "ruc";
}

function normalizeCustomerDisplay(customer: Contact) {
  const isCF = customer.identificationType === "consumidor_final";
  return {
    contactId: customer.id,
    identificationType: normalizeIdType(customer.identificationType),
    identification: isCF ? "9999999999999" : (customer.identification ?? ""),
    name: isCF ? "CONSUMIDOR FINAL" : (customer.name ?? ""),
    // IMPORTANT: avoid undefined in Firestore payload
    email: customer.email ?? "",
    address: customer.address ?? "",
    phone: customer.phone ?? "",
  };
}

/* ---------------------------------------------------
 SRI-like rows (table look)
--------------------------------------------------- */
function SriRow({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_140px] border-b border-black">
      <div className={`px-2 py-2 ${bold ? "font-bold" : ""}`}>{label}</div>
      <div className={`px-2 py-2 text-right border-l border-black ${bold ? "font-bold" : ""}`}>
        {money(value)}
      </div>
    </div>
  );
}

/* ---------------------------------------------------
 Component
--------------------------------------------------- */
type Props = {
  entityId: string;
  contacts: Contact[];
  onSaved?: (saved: any) => void;
};

export default function InvoiceForm({ entityId, contacts, onSaved }: Props) {
  const user = getAuth().currentUser;

  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [contactId, setContactId] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);

  const customer = useMemo(
    () => contacts.find((c) => c.id === contactId) ?? null,
    [contacts, contactId]
  );

  /* ---------------------------------------------------
   Totals — EXACT SRI STRUCTURE
   (Never undefined; ready for Firestore)
  --------------------------------------------------- */
  const totals: InvoiceTotals = useMemo(() => {
    const subtotalsByRate: Record<TaxRate, number> = { 0: 0, 12: 0, 15: 0 };
    const ivaByRate: Record<12 | 15, number> = { 12: 0, 15: 0 };

    let subtotalSinImpuestos = 0;
    let discountTotal = 0;

    for (const it of items) {
      if (!it.description?.trim()) continue;

      const rate = (asNum(it.ivaRate) as TaxRate) ?? 0;
      const base = round2(asNum(it.subtotal));
      const iva = round2(asNum(it.ivaValue));
      const disc = round2(asNum(it.discount));

      subtotalsByRate[rate] = round2(subtotalsByRate[rate] + base);
      subtotalSinImpuestos = round2(subtotalSinImpuestos + base);

      if (rate === 12 || rate === 15) {
        ivaByRate[rate] = round2(ivaByRate[rate] + iva);
      }

      discountTotal = round2(discountTotal + disc);
    }

    const total = round2(subtotalSinImpuestos + ivaByRate[12] + ivaByRate[15]);

    return {
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
  }, [items]);

  const validItems = useMemo(
    () => (items ?? []).filter((i) => i.description?.trim().length > 0),
    [items]
  );

  /* ---------------------------------------------------
   Save draft (avoid undefined fields)
  --------------------------------------------------- */
  async function handleSaveDraft() {
    if (!entityId) return alert("Selecciona una empresa.");
    if (!user?.uid) return alert("Usuario no autenticado.");
    if (!customer) return alert("Selecciona un cliente.");
    if (!issueDate) return alert("Selecciona la fecha de emisión.");
    if (validItems.length === 0) return alert("Agrega al menos un ítem con descripción.");

    const payload: CreateInvoiceInput = {
      type: "FACTURA",
      issueDate,
      currency: "USD",

      customer: normalizeCustomerDisplay(customer),

      items: validItems,
      totals,

      note: "",
    };

    setLoading(true);
    try {
      const saved = await createInvoice(entityId, user.uid, payload);
      onSaved?.(saved);
      alert(`✅ Factura guardada (BORRADOR)\nID: ${saved.id}`);
    } catch (e) {
      console.error(e);
      alert("❌ No se pudo grabar la factura.");
    } finally {
      setLoading(false);
    }
  }

  /* ---------------------------------------------------
   Render (LOCKED SRI PRINT LOOK on desktop)
   IMPORTANT: Totals box is BETWEEN Items table and Actions.
  --------------------------------------------------- */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold">Nueva Factura</h2>
          <p className="text-sm text-gray-500">Se guardará como borrador.</p>
        </div>
      </div>

      {/* Date + Client */}
      <div className="grid md:grid-cols-2 gap-4">
        <label className="text-sm">
          <span className="block text-gray-600 font-medium mb-1">Fecha de emisión</span>
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="border rounded px-4 py-2 w-full"
          />
        </label>

        <label className="text-sm">
          <span className="block text-gray-600 font-medium mb-1">Cliente</span>
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="border rounded px-4 py-2 w-full"
          >
            <option value="">Selecciona cliente</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? "Sin nombre"} — {c.identification ?? "Sin ID"}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Items */}
      <InvoiceItemsTable items={items} onChange={setItems} />

      {/* =================================================
         SRI PRINT-STYLE BLOCK (LEFT info + payment | RIGHT totals)
         MUST be visible between items table and buttons.
      ================================================= */}
      <div className="grid lg:grid-cols-[1fr_460px] gap-4 items-start">
        {/* LEFT SIDE (Información Adicional + Forma de pago) */}
        <div className="space-y-3">
          {/* Información Adicional */}
          <div className="bg-white border border-black rounded-none">
            <div className="border-b border-black text-center font-medium py-2">
              Información Adicional
            </div>
            <div className="p-3 text-sm space-y-2">
              <div className="grid grid-cols-[110px_1fr] gap-2">
                <div className="font-medium">Teléfono:</div>
                <div>{customer?.phone?.trim() ? customer.phone : "-"}</div>
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-2">
                <div className="font-medium">Email:</div>
                <div>{customer?.email?.trim() ? customer.email : "-"}</div>
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-2">
                <div className="font-medium">Dirección:</div>
                <div>{customer?.address?.trim() ? customer.address : "-"}</div>
              </div>
            </div>
          </div>

          {/* Forma de pago */}
          <div className="bg-white border border-black rounded-none">
            <div className="grid grid-cols-[1fr_180px]">
              <div className="border-b border-black text-center font-medium py-2">
                Forma de pago
              </div>
              <div className="border-b border-l border-black text-center font-medium py-2">
                Valor
              </div>
            </div>
            <div className="grid grid-cols-[1fr_180px]">
              <div className="p-3 text-sm border-b border-black">
                20 - OTROS CON UTILIZACION DEL SISTEMA FINANCIERO
              </div>
              <div className="p-3 text-sm text-right border-l border-b border-black">
                {money(totals.total)}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE (Totals Box EXACT SRI ORDER) */}
        <div className="bg-white border border-black rounded-none">
          <SriRow label="SUBTOTAL 15%" value={nz(totals.subtotalsByRate[15])} />
          <SriRow label="SUBTOTAL 12%" value={nz(totals.subtotalsByRate[12])} />
          <SriRow label="SUBTOTAL 0%" value={nz(totals.subtotalsByRate[0])} />

          <SriRow label="SUBTOTAL NO OBJETO DE IVA" value={nz(totals.subtotalNoObjetoIVA)} />
          <SriRow label="SUBTOTAL EXENTO DE IVA" value={nz(totals.subtotalExentoIVA)} />
          <SriRow label="SUBTOTAL SIN IMPUESTOS" value={nz(totals.subtotalSinImpuestos)} />

          <SriRow label="TOTAL DESCUENTO" value={nz(totals.discountTotal)} />
          <SriRow label="ICE" value={nz(totals.ice)} />

          <SriRow label="IVA 15%" value={nz(totals.ivaByRate[15])} />
          <SriRow label="IVA 12%" value={nz(totals.ivaByRate[12])} />

          <SriRow label="IRBPNR" value={nz(totals.irbpnr)} />
          <SriRow label="PROPINA" value={nz(totals.propina)} />

          <SriRow label="VALOR TOTAL" value={nz(totals.total)} bold />

          {/* Optional print-style footer box (like the sample) */}
          <div className="border-t border-black">
            <div className="grid grid-cols-[1fr_140px]">
              <div className="px-2 py-2">VALOR TOTAL SIN SUBSIDIO</div>
              <div className="px-2 py-2 text-right border-l border-black">{money(0)}</div>
            </div>
            <div className="grid grid-cols-[1fr_140px]">
              <div className="px-2 py-2">
                AHORRO POR SUBSIDIO:
                <div className="text-xs">(Incluye IVA cuando corresponda)</div>
              </div>
              <div className="px-2 py-2 text-right border-l border-black">{money(0)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions (must stay BELOW totals box) */}
      <div className="flex justify-end gap-3">
        <button type="button" className="px-4 py-2 border rounded">
          Cancelar
        </button>

        <button
          type="button"
          disabled={loading || validItems.length === 0}
          onClick={handleSaveDraft}
          className="px-6 py-2 bg-blue-700 text-white rounded disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Guardar Borrador"}
        </button>
      </div>
    </div>
  );
}
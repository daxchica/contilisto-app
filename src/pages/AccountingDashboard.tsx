// ============================================================================
// AccountingDashboard.tsx
// CONTILISTO — STABLE VERSION (UPGRADED, SAFE)
// ============================================================================

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import { useSelectedEntity } from "../context/SelectedEntityContext";

import JournalTable from "@/components/journal/JournalTable";
import ManualEntryModal from "../components/modals/ManualEntryModal";
import ChartOfAccountsModal from "../components/modals/ChartOfAccountsModal";
import JournalPreviewModal from "../components/modals/JournalPreviewModal";
import PDFDropzone from "../components/PDFDropzone";

import type { Account } from "../types/AccountTypes";
import type { JournalEntry } from "../types/JournalEntry";
import type { InvoicePreviewMetadata } from "@/types/InvoicePreviewMetadata";

import {
  fetchJournalEntries,
  saveJournalEntries,
} from "@/services/journalService";

import {
  checkProcessedInvoice,
  logProcessedInvoice,
  deleteInvoicesFromFirestoreLog,
} from "../services/firestoreLogService";

import {
  deleteInvoicesFromLocalLog,
} from "../services/localLogService";

import { extractInvoiceOCR } from "@/services/extractInvoiceOCRService";
import { isInvoiceIncomplete } from "@/utils/invoiceValidation";

import { extractInvoiceVision } from "../services/extractInvoiceVisionService";
import { fetchCustomAccounts } from "../services/chartOfAccountsService";
import { getPdfPageCount } from "@/utils/pdfUtils";
import ECUADOR_COA from "@/../shared/coa/ecuador_coa";

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(String(reader.result).replace(/^data:.*;base64,/, ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeString(...values: (string | undefined | null)[]) {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------

export default function AccountingDashboard() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { selectedEntity } = useSelectedEntity();

  const userId = user?.uid ?? "";
  const entityId = selectedEntity?.id ?? "";
  const entityRUC = selectedEntity?.ruc ?? "";

  // ⛔ HARD AUTH GUARD — MUST BE HERE
  if (!loading && !user?.uid) {
    return (
      <div className="p-10 text-center text-red-600">
        Sesión inválida. Cierra sesión y vuelve a ingresar.
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------------------

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [sessionJournal, setSessionJournal] = useState<JournalEntry[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<JournalEntry[]>([]);

  const [previewEntries, setPreviewEntries] = useState<JournalEntry[]>([]);
  const [previewMetadata, setPreviewMetadata] =
    useState<InvoicePreviewMetadata | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  const [logRefreshTrigger, setLogRefreshTrigger] = useState(0);

  // -------------------------------------------------------------------------
  // GUARD — empresa requerida
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (loading) return;
    if (user && !selectedEntity) {
      navigate("/empresas", { replace: true });
    }
  }, [user, loading, selectedEntity, navigate]);

  // -------------------------------------------------------------------------
  // LOAD ACCOUNTS
  // -------------------------------------------------------------------------

  const loadAccounts = useCallback(async () => {
    if (!entityId) {
      setAccounts([]);
      return;
    }

    try {
      const custom = await fetchCustomAccounts(entityId);
      setAccounts([...ECUADOR_COA, ...custom]);
    } catch (err: any) {
    console.error("❌ fetchCustomAccounts blocked:", err.message);
    setAccounts([...ECUADOR_COA]); // fallback
  }
}, [entityId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // -------------------------------------------------------------------------
  // LOAD JOURNAL
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!entityId) {
      setSessionJournal([]);
      return;
    }

    fetchJournalEntries(entityId)
      .then(setSessionJournal)
      .catch((err) => {
        console.warn("Journal load skipped:", err.message);
      });
  }, [entityId, userId, logRefreshTrigger]);

  // -------------------------------------------------------------------------
  // DELETE JOURNAL (SAFE)
// -------------------------------------------------------------------------

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedEntries.length) {
      alert("Seleccione registros de UNA factura.");
      return;
    }

    const tx = selectedEntries[0].transactionId;
    if (!tx) {
      alert("Factura inválida.");
      return;
    }

    alert(
      "⚠️ Este asiento tiene efectos en Cuentas por Pagar.\n" +
        "Por seguridad contable, primero debes revertir o pagar la factura."
    );
  }, [selectedEntries]);

  // -------------------------------------------------------------------------
  // PDF HANDLER
  // -------------------------------------------------------------------------

  const handlePdfFilesSelected = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || showPreviewModal) return;

      if (!userId || !entityId) {
        alert("Sesión o empresa inválida. Recarga la página.");
        return;
      }

      const base64 = await fileToBase64(files[0]);

      // ------------------------------------------------------------------
      // 1️⃣ Detect page count FIRST (multi-page safety)
      // ------------------------------------------------------------------
      let pageCount = 1;
      try {
        pageCount = await getPdfPageCount(base64);
      } catch (err) {
        console.warn("⚠️ Failed to detect PDF page count, assuming 1", err);
      }

      const forceVision = pageCount > 1;
    
      // ------------------------------------------------------------------
      // 2️⃣ OCR only if single-page
      // ------------------------------------------------------------------
      const ocr = forceVision ? null : await extractInvoiceOCR(base64);
      const incomplete = forceVision ? true : isInvoiceIncomplete(ocr!);

      console.log(
        forceVision
          ? `📄 Multi-page (${pageCount}) → forcing Vision`
          : incomplete
            ? "📸 Using Vision extraction"
            : "📄 Using OCR extraction"
      );

      // ------------------------------------------------------------------
      // 3️⃣ Final extraction decision
      // ------------------------------------------------------------------
      const data = forceVision || incomplete
        ? await extractInvoiceVision(base64, entityRUC, userId)
        : ocr!;

      (data as any).__extraction = {
        forcedVision: forceVision,
        pageCount,
        source: forceVision || incomplete ? "vision" : "ocr",
      };

      if (!data.entries.length) {
        alert("No se generaron asientos contables.");
        return;
      }

      const raw = data as Record<string, any>;
      console.log("Invoice extraction result:", data);

      console.group("🧾 Invoice Debug Trace");
      console.log("Source:", incomplete ? "VISION" : "OCR");
      console.log("Entries:", data.entries);
      console.log("Invoice number:", data.invoice_number);
      console.log("Issuer:", data.issuerName, data.issuerRUC);

      console.log("Extraction meta:", (data as any).__extraction);

      const totalsDebug =
        "subtotal12" in data || "iva" in data || "total" in data
          ? {
              subtotal12: (data as any).subtotal12,
              iva: (data as any).iva,
              total: (data as any).total,
            }
          : "(not available in OCR result)";

      console.log("Totals:", totalsDebug);
      console.groupEnd();

      const invoiceType =
        data.invoiceType === "sale" || data.invoiceType === "expense"
          ? data.invoiceType
          : "expense";

      const metadata: InvoicePreviewMetadata = {
        invoiceType,
        issuerRUC: normalizeString(data.issuerRUC, raw.ruc_emisor, raw.ruc),
        issuerName: normalizeString(
          data.issuerName,
          raw.razon_social,
          raw.emisor,
          raw.company_name,
          raw.nombreComercial
        ),
        buyerName: normalizeString(
          data.buyerName,
          raw.cliente,
          raw.razonSocialCliente
        ),
        buyerRUC: normalizeString(data.buyerRUC, raw.ruc_cliente),
        invoiceDate: normalizeString(
          data.invoiceDate,
          raw.fecha_emision,
          raw.fechaFactura
        ),
        invoice_number: normalizeString(
          data.invoice_number,
          raw.numeroFactura,
          raw.numFactura,
          raw.secuencial,
          raw.factura
        ),

        invoiceIdentitySource: data.invoiceIdentitySource,
      };

      const invoiceNumber = metadata.invoice_number ?? "";

      if (!metadata.invoice_number) {
        console.warn( "Invoice number missing — backend fallback applied (SIN-NUMERO or SRI)."
        );
      }

      const alreadyProcessed = await checkProcessedInvoice(
        entityId,
        invoiceNumber
      );

      if (alreadyProcessed) {
        alert(`La factura ${invoiceNumber} ya fue procesada.`);
        return;
      }

      if (showPreviewModal) return;

      const normalized: JournalEntry[] = data.entries.map((e: any) => ({
        ...e,
        id: e.id ?? crypto.randomUUID(),
        entityId,
        uid: userId,
        date: new Date().toISOString().slice(0, 10),
        debit: Number(e.debit ?? 0),
        credit: Number(e.credit ?? 0),
      }));

      setPreviewEntries(normalized);
      setPreviewMetadata(metadata);
      setShowPreviewModal(true);
    },
    [showPreviewModal, entityId, entityRUC, userId]
  );

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  return (
    <>
      <div className="pt-20 pb-32 px-4 w-full">
        <div className="w-full max-w-6xl mx-auto">
          <div className="flex justify-end gap-2 mb-4">
            {entityId && (
              <>
                <button
                  onClick={() => setShowManualModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                  ✍ Ingreso manual
                </button>

                <button
                  onClick={() => setShowAccountsModal(true)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg"
                >
                  📚 Ver Plan de Cuentas
                </button>
              </>
            )}
          </div>

          <div className="mb-8">
            {entityId ? (
              <PDFDropzone onFilesSelected={handlePdfFilesSelected} />
            ) : (
              <div className="p-6 border-2 border-dashed rounded text-center">
                Selecciona una empresa para habilitar la carga de PDFs
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-white shadow-md">
            <JournalTable
              entries={sessionJournal}
              entityName={selectedEntity?.name ?? ""}
              onSelectEntries={setSelectedEntries}
              onDeleteSelected={handleDeleteSelected}
            />
          </div>
        </div>
      </div>

      {showAccountsModal && (
        <ChartOfAccountsModal
          entityId={entityId}
          entityName={selectedEntity?.name ?? ""}
          onClose={() => setShowAccountsModal(false)}
          onAccountsChanged={loadAccounts}
        />
      )}

      {showPreviewModal && previewMetadata && (
        <JournalPreviewModal
          open={showPreviewModal}
          entries={previewEntries}
          metadata={previewMetadata}
          entityId={entityId}
          userId={userId}
          accounts={accounts}
          onClose={() => setShowPreviewModal(false)}
          onSave={async (entries, note) => {
            try {
              const tx = entries[0]?.transactionId || crypto.randomUUID();

              const invoiceNumber =
                previewMetadata?.invoice_number ||
                entries[0]?.invoice_number ||
                "";

              if (!invoiceNumber) {
                console.warn("Invoice number missing — allowing manual or authorization-based fallback.");
              }

              const fixedEntries = entries.map((e) => ({
                ...e,
                entityId,
                uid: userId,
                transactionId: tx,
                description: note,
                createdAt: e.createdAt ?? Date.now(),
                invoice_number: e.invoice_number || invoiceNumber,
              }));

              await saveJournalEntries(entityId, fixedEntries, userId);
              await logProcessedInvoice(entityId, invoiceNumber);

              setLogRefreshTrigger((v) => v + 1);
              setShowPreviewModal(false);
            } catch (err) {
              console.error("Error saving journal:", err);
              alert("Error al guardar el asiento. Revisa permisos o conexión.");
            }
          }}
        />
      )}

      {showManualModal && (
        <ManualEntryModal
          entityId={entityId}
          userId={userId}
          accounts={accounts}
          onClose={() => setShowManualModal(false)}
          onAddEntries={async () => {
            setLogRefreshTrigger((v) => v + 1);
          }}
        />
      )}
    </>
  );
}
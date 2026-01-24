// ============================================================================
// AccountingDashboard.tsx
// CONTILISTO — STABLE VERSION
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
  deleteJournalEntriesByTransactionId,
} from "@/services/journalService";

import {
  deleteInvoicesFromFirestoreLog,
} from "../services/firestoreLogService";

import {
  deleteInvoicesFromLocalLog,
} from "../services/localLogService";

import { extractInvoiceVision } from "../services/extractInvoiceVisionService";
import { fetchCustomAccounts } from "../services/chartOfAccountsService";
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
    const custom = await fetchCustomAccounts(entityId);
    setAccounts([...ECUADOR_COA, ...custom]);
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

    fetchJournalEntries(entityId).then(setSessionJournal);
  }, [entityId, logRefreshTrigger]);

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

      const base64 = await fileToBase64(files[0]);
      const data = await extractInvoiceVision(base64, entityRUC, userId);

      if (!data.entries.length) {
        alert("No se generaron asientos contables.");
        return;
      }

      const normalized: JournalEntry[] = data.entries.map((e: any) => ({
        ...e,
        id: e.id ?? crypto.randomUUID(),
        entityId,
        uid: userId,
        date: new Date().toISOString().slice(0, 10),
        debit: Number(e.debit ?? 0),
        credit: Number(e.credit ?? 0),
      }));

      const raw = data as Record<string, any>;

      const metadata: InvoicePreviewMetadata = {
        invoiceType: data.invoiceType,
        issuerRUC: normalizeString(data.issuerRUC, raw.ruc_emisor, raw.ruc),
        issuerName: normalizeString(data.issuerName, raw.razon_social, raw.emisor, raw.company_name, raw.nombreComercial), 
        buyerName: normalizeString(data.buyerName, raw.cliente, raw.razonSocialCliente),
        buyerRUC: normalizeString(data.buyerRUC, raw.ruc_cliente),
        invoiceDate: normalizeString(data.invoiceDate, raw.fecha_emision, raw.fechaFactura),
        invoice_number: normalizeString(data.invoice_number, raw.numeroFactura, raw.numFactura, raw.secuencial, raw.factura),
      };

      console.log("RAW extractInvoiceVision data:", data);
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
                throw new Error("No se pudo determinar el número de factura");
              }

              const fixedEntries = entries.map(e => ({
                ...e,
                entityId,
                uid: userId,
                transactionId: tx,
                description: note,
                createdAt: e.createdAt ?? Date.now(),

                // ✅ CRITICAL: persist invoice number on EVERY line
                invoice_number: e.invoice_number || invoiceNumber,
              }));

              await saveJournalEntries(entityId, fixedEntries, userId);

              setLogRefreshTrigger(v => v + 1);
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
            setLogRefreshTrigger(v => v + 1);
          }}
        />
      )}
    </>
  );
}
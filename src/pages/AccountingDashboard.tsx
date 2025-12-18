// ============================================================================
// AccountingDashboard.tsx
// Página mejorada — tabla ancha + botones restaurados
// ============================================================================

import React, {
  useEffect,
  useState,
  useCallback,
} from "react";

import { useNavigate } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import { useSelectedEntity } from "../context/SelectedEntityContext";

import NavBar from "@/components/navbar/NavBar";
import Footer from "@/components/footer/Footer";

import JournalTable from "../components/JournalTable";
import ManualEntryModal from "../components/modals/ManualEntryModal";
import ChartOfAccountsModal from "../components/modals/ChartOfAccountsModal";
import JournalPreviewModal from "../components/modals/JournalPreviewModal";
import PDFDropzone from "../components/PDFDropzone";

import type { Account } from "../types/AccountTypes";
import type { JournalEntry } from "../types/JournalEntry";
import { upsertPayable } from "@/services/payablesService";

import {
  fetchJournalEntries,
  saveJournalEntries,
  deleteJournalEntriesByInvoiceNumber
} from "@/services/journalService";

import {
  deleteInvoicesFromFirestoreLog,
  fetchProcessedInvoice,
} from "../services/firestoreLogService";

import {
  deleteInvoicesFromLocalLog,
  logProcessedInvoice,
} from "../services/localLogService";

import { extractInvoiceVision } from "../services/extractInvoiceVisionService";
import { fetchCustomAccounts } from "../services/chartOfAccountsService";
import ECUADOR_COA from "@/../shared/coa/ecuador_coa";


function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(String(reader.result).replace(/^data:.*;base64,/, ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


export default function AccountingDashboard() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const { selectedEntity: globalEntity } = useSelectedEntity();

  const entityId = globalEntity?.id ?? "";
  const entityRUC = globalEntity?.ruc ?? "";
  const entityType = globalEntity?.type ?? "servicios";

  const userIdSafe = user?.uid ?? "";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [sessionJournal, setSessionJournal] = useState<JournalEntry[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<JournalEntry[]>([]);

  const [previewEntries, setPreviewEntries] = useState<JournalEntry[]>([]);
  const [previewMetadata, setPreviewMetadata] = useState<any>(null);

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);

  const [logRefreshTrigger, setLogRefreshTrigger] = useState(0);

  // ============================================================================
  // 🔒 GUARD: empresa requerida
  // ============================================================================
  useEffect(() => {
    if (loading) return;

    if (user && !entityId) {
      navigate("/empresas", { replace: true });
    }
  }, [user, loading, entityId, navigate]);

  // Evita render mientras redirige
  if (loading) return null;
  if (user && !entityId) return null;

  // LOAD ACCOUNTS
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


  // LOAD JOURNAL
  useEffect(() => {
    if (!entityId) {
      setSessionJournal([]);
      return;
    }

    (async () => {
      const entries = await fetchJournalEntries(entityId);
      setSessionJournal(entries);
    })();
  }, [entityId, logRefreshTrigger]);

  useEffect(() => {
  if (loading) return;

  // Usuario logueado pero sin empresa → redirigir
  if (user && !globalEntity) {
    navigate("/empresas", { replace: true });
  }
}, [user, loading, globalEntity, navigate]);

  // DELETE
  const handleDeleteSelected = useCallback(async () => {
    if (!selectedEntries.length) {
      alert("Seleccione registros de UNA factura.");
      return;
    }

    const invoiceNumbers = [
      ...new Set(selectedEntries.map(e => e.invoice_number))
    ].filter(Boolean) as string[];

    if (invoiceNumbers.length !== 1) {
      alert("Solo se puede eliminar una factura a la vez.");
      return;
    }

    const invoice = invoiceNumbers[0];

    if (!confirm(`¿Eliminar factura ${invoice}?`)) return;

    await deleteJournalEntriesByInvoiceNumber(entityId, [invoice]);

    setSessionJournal(prev =>
      prev.filter(e => e.invoice_number !== invoice)
    );

    deleteInvoicesFromLocalLog(entityRUC, [invoice]);
    await deleteInvoicesFromFirestoreLog(entityId, [invoice]);

    setLogRefreshTrigger(prev => prev + 1);
  }, [selectedEntries, entityId, entityRUC]);


  // FILE HANDLER
  const handlePdfFilesSelected = useCallback(async (files: FileList | null) => {
    if (!files || !files.length) return;

    const base64 = await fileToBase64(files[0]);
    const data = await extractInvoiceVision(base64, entityRUC, entityType);

    setPreviewEntries(data.entries ?? []);
    setPreviewMetadata(data);
    setShowPreviewModal(true);
  }, [entityRUC, entityType]);


  return (
    <>
      <NavBar />

      <div className="pt-20 pb-40 px-4 w-full flex justify-center md:px-12 xl:px-20">
        <div className="w-full max-w-6x1">

        {/* BUTTON HEADER */}
        <div className="flex justify-end mb-6">
          {entityId && (
            <button
              onClick={() => setShowAccountsModal(true)}
              className="px-5 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 shadow-sm"
            >
              📚 Ver Plan de Cuentas
            </button>
          )}
        </div>

        {/* DROPZONE CENTER */}
        <div className="max-w-4xl mx-auto mb-10">
          {entityId ? (
            <PDFDropzone onFilesSelected={handlePdfFilesSelected} />
          ) : (
            <div className="p-6 border-2 border-dashed rounded text-center bg-gray-50 text-gray-500">
              Selecciona una empresa para habilitar la carga de PDFs
            </div>
          )}
        </div>

        {/* TABLE FULL WIDTH */}
        <div className="mt-6 mx-auto w-full max-w-6x1 rounded-xl border border-gray-200 bg-white shadow-md overflow-hidden p-4">
          <div className="w-full">
            <JournalTable
              entries={sessionJournal}
              entityName={globalEntity?.name ?? ""}
              onSelectEntries={setSelectedEntries}
              onDeleteSelected={handleDeleteSelected}
              onSave={() => {}}
            />
            </div>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {showAccountsModal && (
        <ChartOfAccountsModal
          entityId={entityId}
          onClose={() => setShowAccountsModal(false)}
          onUploadComplete={loadAccounts}
          accounts={accounts}
        />
      )}

      {showPreviewModal && (
        <JournalPreviewModal
          entries={previewEntries}
          metadata={previewMetadata}
          entityId={entityId}
          userId={userIdSafe}
          accounts={accounts}
          onClose={() => setShowPreviewModal(false)}
          onSave={async (entries, note) => {
            if (!entityId || !userIdSafe) {
              alert("No hay usuario o empresa seleccionada. Vuelve a iniciar sesion.");
              return;
            }

            // 1) Normalizamos las entradas ANTES de mandarlas al servicio
            const fixedEntries: JournalEntry[] = entries.map((e) => ({
              ...e,
              entityId,
              uid: userIdSafe,
              description: note,
              source: e.source ?? "edited",
              createdAt: e.createdAt ?? Date.now(),
            }));

            // 2) Guardamos en Firestores usando el servicio central
            const saved = await saveJournalEntries(entityId, fixedEntries, userIdSafe);

            // 3) Actualizamos el estado local usando LO QUE REALMENTE SE GUARDO
            setSessionJournal(prev => [...prev, ...saved]);

            // 4) Actualizamos logs de facturas procesadas
            const invoiceNumbers = Array.from(
              new Set(saved.map((e) => e.invoice_number).filter(Boolean))
            ) as string[];

            for (const num of invoiceNumbers) {
              // Esto asegura que el log de Firestore y el local queden sincronizados
              await fetchProcessedInvoice(entityId, num);
              logProcessedInvoice(entityRUC, num);
            }

            setLogRefreshTrigger(prev => prev + 1);
            setShowPreviewModal(false);
          }}
        />
      )}
    </>
  );
}
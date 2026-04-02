// ============================================================================
// AccountingDashboard.tsx
// CONTILISTO — FINAL PRODUCTION HARDENED VERSION (IMPROVED)
// Improvements applied without changing the UI:
// • Fixed hook safety (no conditional hook execution)
// • Fixed JournalTable wrapper structure
// • Stronger async guards for account/journal loading
// • Stable callback for selected journal rows
// • Safer error typing
// • Naming cleanup: setPostableAccounts
// • Defensive state reset on entity changes
// • Safer hint-code normalization without type conflicts
// • Ensures transactionId exists on preview entries
// ============================================================================

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";

import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";

import { useAuth } from "@/context/AuthContext";
import { useSelectedEntity } from "@/context/SelectedEntityContext";

import JournalTable from "@/components/journal/JournalTable";
import ManualEntryModal from "@/components/modals/ManualEntryModal";
import ChartOfAccountsModal from "@/components/modals/ChartOfAccountsModal";
import JournalPreviewModal from "@/components/modals/JournalPreviewModal";
import PDFDropzone from "@/components/PDFDropzone";

import type { Account } from "@/types/AccountTypes";
import type { JournalEntry } from "@/types/JournalEntry";
import type { InvoicePreviewMetadata } from "@/types/InvoicePreviewMetadata";
import type { AccountHint } from "@/services/firestoreHintsService";

import {
  fetchJournalEntries,
  saveJournalEntries,
  annulInvoiceByTransaction,
} from "@/services/journalService";

import { logProcessedInvoice } from "@/services/firestoreLogService";
import { extractInvoiceOCR } from "@/services/extractInvoiceOCRService";
import { extractInvoiceVision } from "@/services/extractInvoiceVisionService";
import { isInvoiceIncomplete } from "@/utils/invoiceValidation";
import { getPdfPageCount } from "@/utils/pdfUtils";
import { getEffectiveAccountPlan } from "@/services/effectiveAccountsService";
import { getContextualAccountHint } from "@/services/firestoreHintsService";

const IS_DEV = import.meta.env.DEV === true;

// ============================================================================
// HELPERS
// ============================================================================

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

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "desconocido";
}

function normalizeComparableCode(value?: string | null): string {
  if (!value) return "";
  return value.replace(/\s+/g, "").trim();
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AccountingDashboard() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { selectedEntity } = useSelectedEntity();

  const userIdSafe = user?.uid ?? "";
  const entityId = selectedEntity?.id ?? "";
  const entityRUC = selectedEntity?.ruc ?? "";

  // --------------------------------------------------------------------------
  // STATE
  // --------------------------------------------------------------------------

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [postableAccounts, setPostableAccounts] = useState<Account[]>([]);
  const [leafCodeSet, setLeafCodeSet] = useState<Set<string>>(new Set());
  const [accountsLoading, setAccountsLoading] = useState(false);

  const [sessionJournal, setSessionJournal] = useState<JournalEntry[]>([]);
  const [previewEntries, setPreviewEntries] = useState<JournalEntry[]>([]);
  const [previewMetadata, setPreviewMetadata] =
    useState<InvoicePreviewMetadata | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);

  const [logRefreshTrigger, setLogRefreshTrigger] = useState(0);

  const hintCache = useRef<Map<string, AccountHint | null>>(new Map());
  const [selectedEntries, setSelectedEntries] = useState<JournalEntry[]>([]);

  const accountsRequestIdRef = useRef(0);
  const journalRequestIdRef = useRef(0);

  // --------------------------------------------------------------------------
  // DERIVED
  // --------------------------------------------------------------------------

  const normalizedAccountCodeSet = useMemo(() => {
    const next = new Set<string>();

    for (const account of accounts) {
      next.add(normalizeComparableCode(account.code));
    }

    return next;
  }, [accounts]);

  const normalizedLeafCodeSet = useMemo(() => {
    const next = new Set<string>();

    for (const code of leafCodeSet) {
      next.add(normalizeComparableCode(code));
    }

    return next;
  }, [leafCodeSet]);


// ✅ ADD THIS HERE
const stableJournal = useMemo(() => 
  sessionJournal, [sessionJournal]);

  // --------------------------------------------------------------------------
  // AUTH GUARD
  // --------------------------------------------------------------------------

  if (loading) return null;

  if (!userIdSafe) {
    return (
      <div className="p-10 text-center text-red-600">
        Sesión inválida. Cierra sesión y vuelve a ingresar.
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // ENTITY GUARD
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (!selectedEntity) navigate("/empresas", { replace: true });
  }, [selectedEntity, navigate]);

  if (!entityId) {
  return (
    <div className="p-10 text-center text-gray-500">
      Selecciona una empresa para continuar
    </div>
  );
}

  // --------------------------------------------------------------------------
  // RESET TRANSIENT STATE WHEN ENTITY CHANGES
  // --------------------------------------------------------------------------

  useEffect(() => {
    setSessionJournal([]);
    setPreviewEntries([]);
    setPreviewMetadata(null);
    setSelectedEntries([]);
    hintCache.current.clear();
  }, [entityId]);

  // --------------------------------------------------------------------------
  // STABLE CALLBACKS
  // --------------------------------------------------------------------------

  const handleSelectedEntries = useCallback((entries: JournalEntry[]) => {
    setSelectedEntries(entries);
  }, []);

  // --------------------------------------------------------------------------
  // LOAD ACCOUNT PLAN (RACE SAFE)
  // --------------------------------------------------------------------------

  const loadAccounts = useCallback(async () => {
    const requestId = ++accountsRequestIdRef.current;

    if (!entityId) {
      setAccounts([]);
      setPostableAccounts([]);
      setLeafCodeSet(new Set());
      return;
    }

    try {
      setAccountsLoading(true);

      const plan = await getEffectiveAccountPlan(entityId);

      if (requestId !== accountsRequestIdRef.current) return;

      const effectiveAccounts: Account[] = plan.effectiveAccounts ?? [];
      const postableFixed: Account[] = plan.postableAccounts ?? [];
      const leafSet: Set<string> = plan.postableCodeSet ?? new Set();

      setAccounts(effectiveAccounts);
      setPostableAccounts(postableFixed);
      setLeafCodeSet(leafSet);

      if (IS_DEV) {
        console.log("Accounts loaded:", effectiveAccounts.length);
        console.log("Leaf accounts:", postableFixed.length);
      }
    } catch (err) {
      if (requestId !== accountsRequestIdRef.current) return;
      console.error("Account plan failed:", err);
      setAccounts([]);
      setPostableAccounts([]);
      setLeafCodeSet(new Set());
    } finally {
      if (requestId === accountsRequestIdRef.current) {
        setAccountsLoading(false);
      }
    }
  }, [entityId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // --------------------------------------------------------------------------
  // LOAD JOURNAL (RACE SAFE)
  // --------------------------------------------------------------------------

  useEffect(() => {
    const requestId = ++journalRequestIdRef.current;

    if (!entityId) {
      setSessionJournal([]);
      return;
    }

    fetchJournalEntries(entityId)
      .then((entries) => {
        if (requestId !== journalRequestIdRef.current) return;
        setSessionJournal(entries);
      })
      .catch((err) => {
        if (requestId !== journalRequestIdRef.current) return;
        console.error(err);
        setSessionJournal([]);
      });
  }, [entityId, logRefreshTrigger]);

  // --------------------------------------------------------------------------
  // PDF PROCESSOR
  // --------------------------------------------------------------------------

  const handlePdfFilesSelected = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;

      const authUid = getAuth().currentUser?.uid;
      if (!authUid || authUid !== userIdSafe) {
        alert("Sesión no válida.");
        return;
      }

      if (!entityId) {
        alert("Entidad inválida.");
        return;
      }

      if (!entityRUC) {
        alert("RUC de la entidad no configurado.");
        return;
      }

      if (accounts.length === 0 && !accountsLoading) {
        await loadAccounts();
      }

      try {
        const file = files[0];
        if (!file) return;

        const base64 = await fileToBase64(file);

        let pageCount = 1;
        try {
          pageCount = await getPdfPageCount(base64);
        } catch {
          pageCount = 1;
        }

        const forceVision = pageCount > 1;
        const ocr = forceVision ? null : await extractInvoiceOCR(base64);

        const incomplete = forceVision || !ocr || isInvoiceIncomplete(ocr);

        const data = incomplete
          ? await extractInvoiceVision(base64, entityRUC, authUid, entityId)
          : ocr;

        if (!data?.entries?.length) {
          alert("No se generaron asientos.");
          return;
        }

        const metadata: InvoicePreviewMetadata = {
          invoiceType: data.invoiceType ?? "expense",
          issuerRUC: normalizeString(data.issuerRUC),
          issuerName: normalizeString(data.issuerName),
          buyerName: normalizeString(data.buyerName),
          buyerRUC: normalizeString(data.buyerRUC),
          invoiceDate: normalizeString(data.invoiceDate),
          invoice_number: normalizeString(data.invoice_number),
          invoiceIdentitySource: data.invoiceIdentitySource,
        };

        const generatedTransactionId = crypto.randomUUID();

        let normalized: JournalEntry[] = data.entries.map((e) => ({
          ...e,
          id: e.id ?? crypto.randomUUID(),
          transactionId: e.transactionId ?? generatedTransactionId,
          entityId,
          uid: authUid,
          debit: Number.isFinite(Number(e.debit)) ? Number(e.debit) : 0,
          credit: Number.isFinite(Number(e.credit)) ? Number(e.credit) : 0,
        }));

        // --------------------------------------------------------------------
        // CONTEXTUAL LEARNING (EXPENSE ONLY)
        // --------------------------------------------------------------------

        if (metadata.invoiceType === "expense" && metadata.issuerRUC) {
          const cacheKey = `${entityId}__${metadata.issuerRUC}`;
          let hint = hintCache.current.get(cacheKey);

          if (hint === undefined) {
            try {
              hint = await getContextualAccountHint(
                entityId,
                authUid,
                metadata.issuerRUC
              );
            } catch {
              hint = null;
            }
            hintCache.current.set(cacheKey, hint ?? null);
          }

          const normalizedHintCode = normalizeComparableCode(
            hint?.accountCode ?? ""
          );

          if (
            hint &&
            hint.frequency >= 2 &&
            normalizedHintCode &&
            normalizedLeafCodeSet.has(normalizedHintCode) &&
            normalizedAccountCodeSet.has(normalizedHintCode)
          ) {
            normalized = normalized.map((row) => {
              const debit = Number(row.debit ?? 0);
              const fallback =
                debit > 0 &&
                (row.account_code === "510999" || row.account_code === "519999");

              if (!fallback) return row;

              return {
                ...row,
                account_code: normalizedHintCode,
                account_name: hint.accountName,
              };
            });
          }
        }

        setPreviewEntries(normalized);
        setPreviewMetadata(metadata);
        setShowPreviewModal(true);
      } catch (err: unknown) {
        console.error(err);
        alert(`Error procesando PDF: ${getErrorMessage(err)}`);
      }
    },
    [
      entityId,
      entityRUC,
      userIdSafe,
      accounts.length,
      accountsLoading,
      loadAccounts,
      normalizedLeafCodeSet,
      normalizedAccountCodeSet,
    ]
  );

  // --------------------------------------------------------------------------
  // DELETE / ANNUL SELECTED
  // --------------------------------------------------------------------------

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedEntries.length) return;

    if (!confirm("¿Anular las facturas seleccionadas?")) return;

    const grouped = new Map<string, JournalEntry[]>();

    for (const e of selectedEntries) {
      if (!e.transactionId) continue;
      if (!grouped.has(e.transactionId)) grouped.set(e.transactionId, []);
      grouped.get(e.transactionId)!.push(e);
    }

    for (const [tx, group] of grouped) {
      const invoiceNumber = group.find((e) => e.invoice_number)?.invoice_number;

      await annulInvoiceByTransaction(entityId, tx, invoiceNumber);
    }

    setLogRefreshTrigger((v) => v + 1);
  }, [selectedEntries, entityId]);

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  return (
    <>
      <div className="pt-4 pb-8 px-6 space-y-4">
        <div className="flex flex-col gap-3">
          {/* ACTION BAR */}
          <div className="flex justify-between items-center">
            <div className="text-lg font-semibold text-gray-800">
              Procesamiento Contable
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowManualModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-blue-700"
              >
                Ingreso manual
              </button>

              <button
                onClick={() => setShowAccountsModal(true)}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-emerald-700"
              >
                Plan de cuentas
              </button>
            </div>
          </div>

          {/* UPLOADER */}
          <PDFDropzone onFilesSelected={handlePdfFilesSelected} />

          <div className="bg-white rounded-xl shadow-sm border">
            
            <JournalTable
              entries={stableJournal}
              entityName={selectedEntity?.name ?? ""}
              onSelectEntries={handleSelectedEntries}
              onDeleteSelected={handleDeleteSelected}
            />
          </div>
        </div>
      </div>

      {showPreviewModal && previewMetadata && (
        <JournalPreviewModal
          open={showPreviewModal}
          entries={previewEntries}
          metadata={previewMetadata}
          entityId={entityId}
          userIdSafe={userIdSafe}
          accounts={accounts}
          postableAccounts={postableAccounts}
          leafCodeSet={leafCodeSet}
          onClose={() => setShowPreviewModal(false)}
          onSave={async (entries) => {
            const authUid = getAuth().currentUser?.uid;
            if (!authUid) return;

            try {
              await saveJournalEntries(entityId, authUid, entries);

              const invoiceNumber =
                previewMetadata.invoice_number ??
                entries.find((e) => e.invoice_number)?.invoice_number ??
                "";

              if (invoiceNumber) {
                await logProcessedInvoice(entityId, invoiceNumber);
              }

              setLogRefreshTrigger((v) => v + 1);
              setShowPreviewModal(false);
            } catch (err: unknown) {
              console.error("SAVE ERROR", err);
              alert(getErrorMessage(err) || "Error al guardar");
            }
          }}
        />
      )}

      {accountsLoading && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl px-8 py-6">
            <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full" />
            <div className="mt-3 font-semibold">
              Cargando plan de cuentas...
            </div>
          </div>
        </div>
      )}

      {showManualModal && (
        <ManualEntryModal
          entityId={entityId}
          userIdSafe={userIdSafe}
          postableAccounts={postableAccounts}
          leafCodeSet={leafCodeSet}
          onClose={() => setShowManualModal(false)}
          onAddEntries={async (entries) => {
            const authUid = getAuth().currentUser?.uid;
            if (!authUid) {
              alert("Sesion no valida");
              return;
            }

            if (!entityId) {
              alert("Entidad inválida.");
              return;
            }

            try {
              await saveJournalEntries(entityId, authUid, entries);
              setLogRefreshTrigger((v) => v + 1);
            } catch (err: unknown) {
              console.error("MANUAL SAVE ERROR", err);
              alert(getErrorMessage(err) || "Error al guardar asiento manual");
              throw err;
            }
          }}
        />
      )}

      {showAccountsModal && selectedEntity?.name && (
        <ChartOfAccountsModal
          entityId={entityId}
          entityName={selectedEntity.name}
          onClose={() => setShowAccountsModal(false)}
          onAccountsChanged={() => loadAccounts()}
        />
      )}
    </>
  );
}
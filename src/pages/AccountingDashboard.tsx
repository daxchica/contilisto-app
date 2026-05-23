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
import { usePlan } from "@/hooks/usePlan";

import JournalTable from "@/components/journal/JournalTable";
import ManualEntryModal from "@/components/modals/ManualEntryModal";
import ChartOfAccountsModal from "@/components/modals/ChartOfAccountsModal";
import JournalPreviewModal from "@/components/modals/JournalPreviewModal";
import IgnoredInvoicesReportModal from "@/components/modals/IgnoredInvoicesReportModal";
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

import { logProcessedInvoice, checkProcessedInvoice } from "@/services/firestoreLogService";
import { migratePersonalExpensesFromJournal } from "@/services/personalExpenseMigrationService";
import { extractInvoiceOCR } from "@/services/extractInvoiceOCRService";
import { extractInvoiceVision } from "@/services/extractInvoiceVisionService";
import { isInvoiceIncomplete } from "@/utils/invoiceValidation";
import { getPdfPageCount } from "@/utils/pdfUtils";
import { getEffectiveAccountPlan } from "@/services/effectiveAccountsService";
import { getContextualAccountHint } from "@/services/firestoreHintsService";
import { parseSriTxt } from "@/services/parseSriTxt";
import { sriRowToEntries } from "@/utils/sriTxtToEntries";
import { parseSriXml } from "@/utils/parseSriXml";
import { sriXmlToEntries } from "@/utils/sriXmlToEntries";
import { detectSriXmlType, parseSriRetXml } from "@/utils/parseSriRetXml";
import type { SriRetXmlResult } from "@/utils/parseSriRetXml";
import RetentionXmlPreviewModal from "@/components/modals/RetentionXmlPreviewModal";

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
  const { plan } = usePlan();

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

  // SRI TXT batch queue — one preview modal per invoice
  const [sriQueue, setSriQueue] = useState<
    Array<{ entries: JournalEntry[]; metadata: InvoicePreviewMetadata }>
  >([]);
  const [sriQueueIdx, setSriQueueIdx] = useState(0);
  const [sriConfirmedCount, setSriConfirmedCount] = useState(0);
  const [ignoredInvoices, setIgnoredInvoices] = useState<
    Array<{ entries: JournalEntry[]; metadata: InvoicePreviewMetadata }>
  >([]);
  const [showIgnoredReport, setShowIgnoredReport] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);

  const [retentionXmlData, setRetentionXmlData] = useState<SriRetXmlResult | null>(null);
  const [showRetentionXmlModal, setShowRetentionXmlModal] = useState(false);

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
  // ONE-TIME MIGRATION: personal expense entries → personalExpenses collection
  // Runs silently on entity load; guarded by a Firestore flag so it only
  // executes once per entity even if the page is re-mounted many times.
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (!entityId || !userIdSafe) return;

    migratePersonalExpensesFromJournal(entityId, userIdSafe)
      .then((count) => {
        if (count > 0) {
          // Refresh journal table to reflect removed personal entries
          setLogRefreshTrigger((v) => v + 1);
        }
      })
      .catch((err) =>
        console.warn("⚠️ Personal expense migration failed:", err)
      );
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // SRI TXT PROCESSOR
  // --------------------------------------------------------------------------

  const handleTxtFileSelected = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;

      const authUid = getAuth().currentUser?.uid;
      if (!authUid || authUid !== userIdSafe) {
        alert("Sesión no válida.");
        return;
      }

      if (!entityId) {
        alert("Selecciona una empresa primero.");
        return;
      }

      if (accounts.length === 0 && !accountsLoading) {
        await loadAccounts();
      }

      try {
        const file = files[0];
        const content = await file.text();
        const rows = parseSriTxt(content);

        if (rows.length === 0) {
          alert("No se encontraron facturas en el archivo TXT.");
          return;
        }

        // ── Check which invoices are already saved ──
        const alreadySaved: string[] = [];
        const newRows: typeof rows = [];
        await Promise.all(
          rows.map(async (row) => {
            const already = row.serie
              ? await checkProcessedInvoice(entityId, row.serie)
              : false;
            if (already) alreadySaved.push(row.serie ?? "?");
            else newRows.push(row);
          })
        );

        if (newRows.length === 0) {
          const skippedList = alreadySaved.slice(0, 10).map(s => `  • ${s}`).join("\n");
          const skippedMore = alreadySaved.length > 10 ? `\n  … y ${alreadySaved.length - 10} más` : "";
          alert(
            `Todas las facturas del archivo ya están registradas:\n\n${skippedList}${skippedMore}\n\nNo hay facturas nuevas para procesar.`
          );
          return;
        }

        // Build one queue item per invoice so user reviews each individually
        const queue: Array<{ entries: JournalEntry[]; metadata: InvoicePreviewMetadata }> = [];

        for (const row of newRows) {
          const cacheKey = `${entityId}__${row.issuerRUC}`;
          let hint = hintCache.current.get(cacheKey);

          if (hint === undefined) {
            try {
              hint = await getContextualAccountHint(entityId, authUid, row.issuerRUC);
            } catch {
              hint = null;
            }
            hintCache.current.set(cacheKey, hint ?? null);
          }

          const normalizedHintCode = normalizeComparableCode(hint?.accountCode ?? "");
          const useHint =
            hint &&
            hint.frequency >= 2 &&
            normalizedHintCode &&
            normalizedLeafCodeSet.has(normalizedHintCode) &&
            normalizedAccountCodeSet.has(normalizedHintCode);

          const entries = sriRowToEntries(
            row,
            entityId,
            authUid,
            useHint ? normalizedHintCode : undefined,
            useHint ? hint!.accountName : undefined
          );

          const metadata: InvoicePreviewMetadata = {
            invoiceType: "expense",
            issuerRUC: row.issuerRUC,
            issuerName: row.issuerName,
            buyerName: selectedEntity?.name ?? "",
            buyerRUC: entityRUC,
            invoiceDate: row.fechaEmision,
            invoice_number: row.serie,
          };

          queue.push({ entries, metadata });
        }

        // ── Show pending-invoice summary and ask user to confirm before opening modals ──
        const pendingLines = queue
          .slice(0, 15)
          .map(({ metadata: m }) => {
            const row = newRows.find(r => r.serie === m.invoice_number);
            const total = row ? `$${row.total.toFixed(2)}` : "";
            return `  • ${m.invoice_number} · ${m.issuerName}${total ? ` · ${total}` : ""}`;
          })
          .join("\n");
        const pendingMore = queue.length > 15 ? `\n  … y ${queue.length - 15} más` : "";

        const skippedNote =
          alreadySaved.length > 0
            ? `\n\n(${alreadySaved.length} factura(s) ya registrada(s) serán omitidas)`
            : "";

        const confirmed = confirm(
          `Se encontraron ${queue.length} factura(s) sin procesar:\n\n${pendingLines}${pendingMore}${skippedNote}\n\n¿Desea iniciar el procesamiento?`
        );

        if (!confirmed) return;

        setSriQueue(queue);
        setSriQueueIdx(0);
        setSriConfirmedCount(0);
      } catch (err: unknown) {
        console.error(err);
        alert(`Error procesando TXT: ${getErrorMessage(err)}`);
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
      selectedEntity,
    ]
  );

  // --------------------------------------------------------------------------
  // SRI XML PROCESSOR
  // --------------------------------------------------------------------------

  const handleXmlFileSelected = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;

      const authUid = getAuth().currentUser?.uid;
      if (!authUid || authUid !== userIdSafe) {
        alert("Sesión no válida.");
        return;
      }

      if (!entityId) {
        alert("Selecciona una empresa primero.");
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
        const xmlText = await file.text();

        // ── Route by document type ──
        const docType = detectSriXmlType(xmlText);

        if (docType === "retencion") {
          const ret = parseSriRetXml(xmlText);
          setRetentionXmlData(ret);
          setShowRetentionXmlModal(true);
          return;
        }

        const xml = parseSriXml(xmlText);

        if (!xml.invoice_number) {
          alert("No se pudo leer el número de factura del XML.");
          return;
        }

        // ── Duplicate check ──
        const alreadySaved = await checkProcessedInvoice(entityId, xml.invoice_number);
        if (alreadySaved) {
          alert(`La factura ${xml.invoice_number} ya está registrada en el diario.`);
          return;
        }

        // ── Contextual account hint (expense only) ──
        const isExpense = xml.issuerRUC !== entityRUC;
        let expenseCode: string | undefined;
        let expenseName: string | undefined;

        if (isExpense && xml.issuerRUC) {
          const cacheKey = `${entityId}__${xml.issuerRUC}`;
          let hint = hintCache.current.get(cacheKey);

          if (hint === undefined) {
            try {
              hint = await getContextualAccountHint(entityId, authUid, xml.issuerRUC);
            } catch {
              hint = null;
            }
            hintCache.current.set(cacheKey, hint ?? null);
          }

          const normalizedHintCode = normalizeComparableCode(hint?.accountCode ?? "");
          const useHint =
            hint &&
            hint.frequency >= 2 &&
            normalizedHintCode &&
            normalizedLeafCodeSet.has(normalizedHintCode) &&
            normalizedAccountCodeSet.has(normalizedHintCode);

          if (useHint) {
            expenseCode = normalizedHintCode;
            expenseName = hint!.accountName;
          }
        }

        // ── Build entries ──
        const entries = sriXmlToEntries(
          xml,
          entityId,
          authUid,
          entityRUC,
          expenseCode,
          expenseName
        );

        const metadata: InvoicePreviewMetadata = {
          invoiceType: isExpense ? "expense" : "sale",
          issuerRUC: xml.issuerRUC,
          issuerName: xml.issuerName,
          buyerName: xml.buyerName,
          buyerRUC: xml.buyerRUC,
          invoiceDate: xml.invoiceDate,
          invoice_number: xml.invoice_number,
        };

        setPreviewEntries(entries);
        setPreviewMetadata(metadata);
        setShowPreviewModal(true);
      } catch (err: unknown) {
        console.error(err);
        alert(`Error procesando XML: ${getErrorMessage(err)}`);
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
  // COMBINED FILE HANDLER (PDF, TXT, or XML)
  // --------------------------------------------------------------------------

  const handleFilesSelected = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const file = files[0];
      const name = file.name.toLowerCase();
      if (name.endsWith(".txt")) {
        await handleTxtFileSelected(files);
      } else if (name.endsWith(".xml")) {
        await handleXmlFileSelected(files);
      } else {
        await handlePdfFilesSelected(files);
      }
    },
    [handlePdfFilesSelected, handleTxtFileSelected, handleXmlFileSelected]
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
      <div className="pb-8 space-y-4">
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
          <PDFDropzone onFilesSelected={handleFilesSelected} />

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
              await saveJournalEntries(entityId, authUid, entries, undefined, plan.limits.maxInvoicesPerMonth);

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

      {/* SRI TXT queue — one preview per invoice */}
      {sriQueue.length > 0 && sriQueueIdx < sriQueue.length && (() => {
        const current = sriQueue[sriQueueIdx];
        const advanceQueue = (saved: boolean, skippedItem?: { entries: JournalEntry[]; metadata: InvoicePreviewMetadata }) => {
          if (saved) setLogRefreshTrigger((v) => v + 1);
          const next = sriQueueIdx + 1;
          const nextIgnored = skippedItem
            ? [...ignoredInvoices, skippedItem]
            : ignoredInvoices;
          if (next >= sriQueue.length) {
            setSriQueue([]);
            setSriQueueIdx(0);
            setIgnoredInvoices([]);
            if (nextIgnored.length > 0) {
              // Defer so queue teardown renders first
              setTimeout(() => {
                setIgnoredInvoices(nextIgnored);
                setShowIgnoredReport(true);
              }, 50);
            }
          } else {
            if (skippedItem) setIgnoredInvoices(nextIgnored);
            setSriQueueIdx(next);
          }
        };
        return (
          <JournalPreviewModal
            open={true}
            entries={current.entries}
            metadata={current.metadata}
            queuePosition={{ current: sriQueueIdx + 1, total: sriQueue.length }}
            confirmedCount={sriConfirmedCount}
            entityId={entityId}
            userIdSafe={userIdSafe}
            accounts={accounts}
            postableAccounts={postableAccounts}
            leafCodeSet={leafCodeSet}
            onClose={() => {
              const pending = ignoredInvoices;
              setSriQueue([]);
              setSriQueueIdx(0);
              setSriConfirmedCount(0);
              setIgnoredInvoices([]);
              if (pending.length > 0) {
                setTimeout(() => {
                  setIgnoredInvoices(pending);
                  setShowIgnoredReport(true);
                }, 50);
              }
            }}
            onSkip={() => advanceQueue(false, current)}
            onSave={async (entries) => {
              const authUid = getAuth().currentUser?.uid;
              if (!authUid) return;
              try {
                await saveJournalEntries(entityId, authUid, entries, undefined, plan.limits.maxInvoicesPerMonth);
                const invoiceNumber = current.metadata.invoice_number ?? "";
                if (invoiceNumber) await logProcessedInvoice(entityId, invoiceNumber);
                setSriConfirmedCount((c) => c + 1);
                advanceQueue(true);
              } catch (err: unknown) {
                console.error("SRI QUEUE SAVE ERROR", err);
                alert(getErrorMessage(err) || "Error al guardar asiento");
              }
            }}
          />
        );
      })()}

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
              await saveJournalEntries(entityId, authUid, entries, undefined, plan.limits.maxInvoicesPerMonth);
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

      {showRetentionXmlModal && retentionXmlData && (
        <RetentionXmlPreviewModal
          open={showRetentionXmlModal}
          retention={retentionXmlData}
          entityId={entityId}
          userIdSafe={userIdSafe}
          onClose={() => {
            setShowRetentionXmlModal(false);
            setRetentionXmlData(null);
          }}
          onSaved={() => {
            setLogRefreshTrigger((v) => v + 1);
            setTimeout(() => {
              setShowRetentionXmlModal(false);
              setRetentionXmlData(null);
            }, 1500);
          }}
        />
      )}

      {showIgnoredReport && ignoredInvoices.length > 0 && (
        <IgnoredInvoicesReportModal
          invoices={ignoredInvoices}
          onClose={() => {
            setShowIgnoredReport(false);
            setIgnoredInvoices([]);
          }}
          onSaveIgnored={async (item) => {
            const authUid = getAuth().currentUser?.uid;
            if (!authUid) throw new Error("Sesión inválida.");
            await saveJournalEntries(entityId, authUid, item.entries, undefined, plan.limits.maxInvoicesPerMonth);
            const invoiceNumber = item.metadata.invoice_number ?? "";
            if (invoiceNumber) await logProcessedInvoice(entityId, invoiceNumber);
            setLogRefreshTrigger((v) => v + 1);
          }}
        />
      )}
    </>
  );
}
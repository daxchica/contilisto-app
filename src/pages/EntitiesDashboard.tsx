// src/pages/EntitiesDashboard.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase-config";
import { useSelectedEntity } from "../context/SelectedEntityContext";

import PDFUploader from "../components/PDFUploader";
import JournalTable from "../components/JournalTable";
import ManualEntryModal from "../components/ManualEntryModal";
import ChartOfAccountsModal from "../components/ChartOfAccountsModal";
import AddEntityModal from "../components/AddEntityModal";
import JournalPreviewModal from "../components/JournalPreviewModal";

import type { Account } from "../types/AccountTypes";
import type { JournalEntry } from "../types/JournalEntry";
import type { Entity, EntityType } from "../types/Entity";

import { createEntity, deleteEntity, fetchEntities } from "../services/entityService";
import {
  fetchJournalEntries,
  deleteJournalEntriesByInvoiceNumber,
  saveJournalEntries,
  deleteJournalEntriesByIds,
} from "@/services/journalService";
import {
  deleteInvoicesFromFirestoreLog,
  clearFirestoreLogForEntity,
  fetchProcessedInvoice as logProcessedInvoiceToFirestore,
} from "../services/firestoreLogService";
import {
  clearLocalLogForEntity,
  deleteInvoicesFromLocalLog,
  getProcessedInvoices,
  logProcessedInvoice as logToLocalStorage,
} from "../services/localLogService";

import { fetchCustomAccounts } from "../services/chartOfAccountsService";
import ECUADOR_COA from "../../shared/coa/ecuador_coa";

/* ---------------- Dev helper (only in DEV) ---------------- */
function DevLogResetButton({
  entityId,
  ruc,
  onReset,
}: {
  entityId: string;
  ruc: string;
  onReset: () => void;
}) {
  if (!entityId || !ruc || process.env.NODE_ENV !== "development") return null;

  const handleReset = async () => {
    if (!window.confirm("¿Borrar todos los logs procesados?")) return;
    await clearFirestoreLogForEntity(entityId);
    clearLocalLogForEntity(ruc);
    onReset();
    alert("✔️ Logs borrados.");
  };

  return (
    <button
      onClick={handleReset}
      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded w-fit"
    >
      🧹 Borrar logs de facturas procesadas (DEV)
    </button>
  );
}

/* ---------------- Facturas procesadas ---------------- */
function InvoiceLogDropdown({
  entityId,
  ruc,
  onDelete,
  logRefreshTrigger,
}: {
  entityId: string;
  ruc: string;
  onDelete: () => void;
  logRefreshTrigger: number;
}) {
  const [invoices, setInvoices] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!entityId || !ruc) {
      setInvoices([]);
      setSelected(new Set());
      return;
    }
    setInvoices(Array.from(getProcessedInvoices(ruc)));
    setSelected(new Set());
  }, [entityId, ruc, logRefreshTrigger]);

  const toggleInvoice = useCallback((invoice: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(invoice) ? next.delete(invoice) : next.add(invoice);
      return next;
    });
  }, []);

  const handleDeleteSelected = useCallback(async (): Promise<void> => {
  // ✅ Ensure an entity is selected before attempting deletion
  if (!selected.size) {
    alert("⚠️ Debes seleccionar una empresa antes de eliminar registros.");
    return;
  }
  if (!window.confirm("¿Deseas eliminar los registros seleccionados?")) return;

  const toDelete = Array.from(selected);

  try {
    await deleteInvoicesFromFirestoreLog(entityId, toDelete);
    deleteInvoicesFromLocalLog(ruc, toDelete);
    await deleteJournalEntriesByInvoiceNumber(entityId, toDelete);

    setInvoices((prev) => prev.filter((inv) => !toDelete.includes(inv)));
    setSelected(new Set());
    onDelete();
    alert("Facturas eliminados correctamente.");
  } catch (err) {
    console.error("❌ Error al eliminar asientos:", err);
    alert("❌ Error al eliminar registros de Firestore. Revisa la consola.");
  }
}, [entityId, ruc, selected, onDelete]);

  if (!invoices.length) return null;

  return (
    <div className="mt-4 p-4 bg-white border rounded shadow">
      <h3 className="font-bold mb-2">🧾 Facturas procesadas</h3>
      <ul className="max-h-40 overflow-y-auto">
        {invoices.map((inv) => (
          <li key={inv} className="flex items-center gap-2 mb-1">
            <input
              type="checkbox"
              checked={selected.has(inv)}
              onChange={() => toggleInvoice(inv)}
              aria-label={`Seleccionar factura ${inv}`}
            />
            <span className="text-sm text-gray-700">{inv}</span>
          </li>
        ))}
      </ul>
      <button
        disabled={selected.size === 0}
        onClick={handleDeleteSelected}
        className="mt-2 bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 w-fit disabled:opacity-50"
      >
        🗑️ Borrar seleccionadas
      </button>
    </div>
  );
}

/* =========================== Page =========================== */
export default function EntitiesDashboard() {
  const [user] = useAuthState(auth);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [sessionJournal, setSessionJournal] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewEntries, setPreviewEntries] = useState<JournalEntry[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<JournalEntry[]>([]);

  const { entity: globalEntity, setEntity } = useSelectedEntity();
  const selectedEntity = useMemo(
    () => entities.find((e) => e.id === selectedEntityId) ?? null,
    [selectedEntityId, entities]
  );

  // ✅ Safe fallbacks for strict string props
  const selectedEntityIdSafe: string = selectedEntityId ?? "";
  const selectedEntityRUC: string = selectedEntity?.ruc ?? "";
  const selectedEntityType: string = selectedEntity?.type ?? "servicios";
  const userIdSafe: string = user?.uid ?? auth.currentUser?.uid ?? "";

  const [loadingJournal, setLoadingJournal] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showAddEntity, setShowAddEntity] = useState(false);
  const [logRefreshTrigger, setLogRefreshTrigger] = useState(0);

  /* ==================== CORE REFRESH FUNCTION ==================== */
  const refreshJournal = useCallback(async () => {
    if (!selectedEntityId) {
      setSessionJournal([]);
      return;
    }

    try {
      setLoadingJournal(true);
      const fetched = await fetchJournalEntries(selectedEntityId);
      setSessionJournal(fetched);
      console.log(`✅ Journal recargado: ${fetched.length} asientos`);
    } catch (err) {
      console.error("Error loading journal entries:", err);
      setSessionJournal([]);
    } finally {
      setLoadingJournal(false);
    }
  }, [selectedEntityId]);

  /* Load user entities */
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchEntities(user.uid);
        if (!cancelled) setEntities(list);
      } catch (err) {
        console.error("Error fetching entities:", err);
        if (!cancelled) setEntities([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  /* Sync global context */
  useEffect(() => {
    setSelectedEntityId(globalEntity?.id ?? "");
  }, [globalEntity?.id]);

  useEffect(() => {
    if (selectedEntity)
      setEntity({
        id: selectedEntity.id ?? "",
        ruc: selectedEntity.ruc ?? "",
        name: selectedEntity.name ?? "",
        type: selectedEntity.type ?? "servicios",
      });
    else setEntity(null);
  }, [selectedEntity, setEntity]);

  /* Load journal for selected entity */
  useEffect(() => {
    refreshJournal();
  }, [refreshJournal]);

  /* ✅ Load merged Chart of Accounts with custom accounts */
  const loadAccounts = useCallback(async () => {
    if (!selectedEntityId) {
      setAccounts([]);
      return;
    }
    try {
      const custom = await fetchCustomAccounts(selectedEntityId);
      const merged: Account[] = [
        ...ECUADOR_COA.map((a) => ({
          ...a,
          level: (a.level ?? Math.floor(a.code.length / 2)) || 1,
        })),
        ...custom.map((c) => ({
          ...c,
          level: Math.floor(c.code.length / 2) || 1,
        })),
      ];
      setAccounts(merged);
      console.log(`📘 Cuentas cargadas (${merged.length})`);
    } catch (err) {
      console.error("Error loading chart of accounts:", err);
      setAccounts([]);
    }
  }, [selectedEntityId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    const refresh = () => {
      console.log("♻️ Reloading accounts due to event...");
      loadAccounts();
    };
    window.addEventListener("refreshAccounts", refresh);
    return () => window.removeEventListener("refreshAccounts", refresh);
  }, [loadAccounts]);

  /* ==================== HANDLERS ==================== */
  const handleEntityCreated = useCallback(
    async ({
      ruc,
      name,
      entityType,
    }: {
      ruc: string;
      name: string;
      entityType: EntityType;
    }) => {
      if (!user?.uid) return;
      await createEntity({
        ruc: ruc.trim(),
        name: name.trim(),
        type: entityType.trim(),
      });
      const updated = await fetchEntities(user.uid);
      setEntities(updated);
      const newlyCreated =
        updated.find((e) => e.ruc === ruc && e.name === name) ??
        updated[updated.length - 1];
      if (newlyCreated) setSelectedEntityId(newlyCreated.id ?? "");
      alert("✅ Entidad creada.");
    },
    [user?.uid]
  );

  const handlePDFUploadComplete = useCallback((entries: JournalEntry[]) => {
    console.log("📄 PDF procesado, mostrando preview con", entries.length, "asientos");
    setPreviewEntries(entries);
    setShowPreviewModal(true);
  }, []);

  const handleManualEntriesAdded = useCallback(
    async (entries: JournalEntry[]) => {
      console.log("✍️ Asientos manuales agregados:", entries.length);
      await refreshJournal();
    },
    [refreshJournal]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedEntries.length) {
      alert("No hay registros seleccionados.");
      return;
    }
    if (!window.confirm("¿Deseas eliminar los registros seleccionados?")) return;

    const ids = selectedEntries
      .map((e) => e.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    if (ids.length === 0) {
      alert("No se encontraron IDs válidos para eliminar.");
      return;
    }

    try {
      await deleteJournalEntriesByIds(ids, selectedEntityIdSafe, userIdSafe);
      await refreshJournal();
      setSelectedEntries([]);
      alert(`🧹 ${ids.length} asientos eliminados.`);
    } catch (err) {
      console.error("Error al eliminar asientos:", err);
      alert("❌ Error al eliminar registros de Firestore. Revisa la consola.");
    }
  }, [selectedEntries, selectedEntityIdSafe, userIdSafe, refreshJournal]);

  /* ------------------------------ UI ------------------------------ */
  return (
    <>
      <div className="pt-20 pb-6 max-w-screen-xl mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-blue-900 flex items-center">
            <span className="mr-2 text-3xl">📊</span> Contilisto Tablero de Entidades
          </h1>
          <button
            onClick={() => setShowAccountsModal(true)}
            disabled={!selectedEntityId}
            className="px-4 py-2 bg-emerald-500 text-white rounded shadow hover:bg-emerald-600 disabled:opacity-50 transition"
          >
            📚 Ver Plan de Cuentas
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left column */}
          <div>
            <button
              onClick={() => setShowAddEntity(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mb-3"
            >
              ➕ Agregar Entidad
            </button>

            <select
              id="entity-select"
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="">- Seleccionar -</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.ruc} - {e.name}
                </option>
              ))}
            </select>

            <DevLogResetButton
              entityId={selectedEntityId}
              ruc={selectedEntityRUC}
              onReset={() => setLogRefreshTrigger((p) => p + 1)}
            />

            {selectedEntity && (
              <InvoiceLogDropdown
                key={`${selectedEntityId}-${logRefreshTrigger}`}
                entityId={selectedEntityId}
                ruc={selectedEntityRUC}
                onDelete={() => {
                  refreshJournal();
                  setLogRefreshTrigger((p) => p + 1);
                }}
                logRefreshTrigger={logRefreshTrigger}
              />
            )}
          </div>

          {/* Right column */}
          <div>
            <button
              onClick={() => setShowManualModal(true)}
              disabled={!selectedEntityId}
              className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 disabled:opacity-50 transition mb-3"
            >
              ➕ Carga Manual
            </button>

            {selectedEntity && selectedEntityRUC && selectedEntity.id && selectedEntity.type ? (
              <PDFUploader
                userRUC={selectedEntityRUC}
                entityId={selectedEntityIdSafe}
                userId={userIdSafe}
                accounts={accounts}
                entityType={selectedEntityType}
                onUploadComplete={handlePDFUploadComplete}
              />
            ) : (
              <div className="p-6 border-2 border-dashed rounded text-gray-500 text-center">
                Selecciona una entidad para habilitar la carga de PDFs.
              </div>
            )}
          </div>
        </div>
      </div>

      {!loadingJournal && sessionJournal.length > 0 && (
        <JournalTable
          entries={sessionJournal}
          entityName={selectedEntity?.name ?? ""}
          onDeleteSelected={handleDeleteSelected}
          onSelectEntries={setSelectedEntries}
          onSave={() => {}}
        />
      )}

      {showAccountsModal && selectedEntityId && (
        <ChartOfAccountsModal
          entityId={selectedEntityIdSafe}
          onClose={() => setShowAccountsModal(false)}
          accounts={accounts}
          onUploadComplete={() => loadAccounts()}
        />
      )}

      {showManualModal && selectedEntityId && (
        <ManualEntryModal
          onClose={() => setShowManualModal(false)}
          entityId={selectedEntityIdSafe}
          userId={userIdSafe}
          onAddEntries={handleManualEntriesAdded}
          accounts={accounts}
        />
      )}

      {showPreviewModal && (
        <JournalPreviewModal
          key={`${selectedEntityId}-${logRefreshTrigger}`}
          entries={previewEntries}
          accounts={accounts}
          entityId={selectedEntityIdSafe}
          userId={userIdSafe}
          onClose={() => {
            setShowPreviewModal(false);
            setPreviewEntries([]);
          }}
          onSave={async (entries, note) => {
            await saveJournalEntries(selectedEntityIdSafe, entries, userIdSafe);

            const invoiceNumbers: string[] = entries
              .map((e) => e.invoice_number)
              .filter((num): num is string => typeof num === "string" && num.trim().length > 0);

            if (invoiceNumbers.length) {
              for (const num of invoiceNumbers) {
                await logProcessedInvoiceToFirestore(String(selectedEntityIdSafe), String(num));
                logToLocalStorage(selectedEntityRUC, String(num));
              }
            }

            await refreshJournal();
            setLogRefreshTrigger((p) => p + 1);

            alert("Asientos guardados correctamente");
            setShowPreviewModal(false);
            setPreviewEntries([]);
          }}
        />
      )}

      <AddEntityModal
        isOpen={showAddEntity}
        onClose={() => setShowAddEntity(false)}
        onCreate={handleEntityCreated}
      />
    </>
  );
}
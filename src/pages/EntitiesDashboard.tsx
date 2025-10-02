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
import type { Entity } from "../types/Entity";

import {
  createEntity,
  deleteEntity,
  fetchEntities,
} from "../services/entityService";
import {
  fetchJournalEntries,
  deleteJournalEntriesByInvoiceNumber,
  deleteJournalEntriesByTransactionId,
  saveJournalEntries,
} from "../services/journalService";
import {
  deleteInvoicesFromFirestoreLog,
  clearFirestoreLogForEntity,
  fetchProcessedInvoice,
} from "../services/firestoreLogService";
import {
  logProcessedInvoice,
  clearLocalLog,
  clearLocalLogForEntity,
  deleteInvoicesFromLocalLog,
  getProcessedInvoices,
  getAllInvoicesForEntity,
  saveInvoiceToLocalLog,
} from "../services/localLogService";

// merged chart loader
import { getEntityChart } from "../services/getEntityChart";

/* ---------------- Dev helper (only in DEV) ---------------- */
function DevLogResetButton({ entityId, ruc, setSessionJournal, }: { entityId: string; ruc: string; setSessionJournal: React.Dispatch<React.SetStateAction<JournalEntry[]>> }) {
  if (!entityId || !ruc || process.env.NODE_ENV !== "development") return null;

  const handleReset = async () => {
    if (!window.confirm("¿Borrar todos los logs procesados?")) return;
    await clearFirestoreLogForEntity(entityId);
    clearLocalLogForEntity(ruc);
    await clearFirestoreLogForEntity(entityId);
    setSessionJournal([]);
    alert("✔️ Logs borrados.");
  };
  return (
    <button onClick={handleReset} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded w-fit">
      🧹 Borrar logs de facturas procesadas (DEV)
    </button>
  );
}

/* ---------------- Facturas procesadas ---------------- */
function InvoiceLogDropdown({ entityId, ruc, setSessionJournal,}: { entityId: string; ruc: string; setSessionJournal: React.Dispatch<React.SetStateAction<JournalEntry[]>> }) {
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
  }, [entityId, ruc]);

  const toggleInvoice = useCallback((invoice: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(invoice) ? next.delete(invoice) : next.add(invoice);
      return next;
    });
  }, []);
  const handleDeleteSelected = useCallback(async () => {
    if (!selected.size) return;
    if (!window.confirm("¿Borrar las facturas seleccionadas del log?")) return;
    const toDelete = Array.from(selected);
    await deleteInvoicesFromFirestoreLog(entityId, toDelete);
    deleteInvoicesFromLocalLog(ruc, toDelete);
    await deleteJournalEntriesByInvoiceNumber(entityId, toDelete);
    setInvoices((prev) => prev.filter((inv) => !toDelete.includes(inv)));
    setSelected(new Set());
    setSessionJournal((prev) => prev.filter((entry) => !toDelete.includes((entry.invoice_number ?? "").trim())));
    alert("🗑️ Facturas eliminadas del log.");
  }, [entityId, ruc, selected, setSessionJournal]);
  if (!invoices.length) return null;
  return (
    <div className="mt-4 p-4 bg-white border rounded shadow">
      <h3 className="font-bold mb-2">🧾 Facturas procesadas</h3>
      <ul className="max-h-40 overflow-y-auto">
        {invoices.map((inv) => (
          <li key={inv} className="flex items-center gap-2 mb-1">
            <input type="checkbox" checked={selected.has(inv)} onChange={() => toggleInvoice(inv)} aria-label={`Seleccionar factura ${inv}`}/>
            <span className="text-sm text-gray-700">{inv}</span>
          </li>
        ))}
      </ul>
      <button disabled={selected.size === 0} onClick={handleDeleteSelected} className="mt-2 bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 w-fit disabled:opacity-50">
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
  const [historicalJournal, setHistoricalJournal] = useState<JournalEntry[]>([]);
  const [sessionJournal, setSessionJournal] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewEntries, setPreviewEntries] = useState<JournalEntry[]>([]);
  const { entity: globalEntity, setEntity } = useSelectedEntity();
  const selectedEntity = useMemo(() => entities.find((e) => e.id === selectedEntityId) ?? null, [selectedEntityId, entities]);
  const selectedEntityRUC = selectedEntity?.ruc ?? "";

  const [loadingJournal, setLoadingJournal] = useState(false);
  const [entityToDelete, setEntityToDelete] =
    useState<{ id: string; ruc: string; name: string } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showAddEntity, setShowAddEntity] = useState(false);
  type Entity = { id: string; ruc: string; name: string };

  /* 1) Load user entities */
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchEntities(user.uid);
        if (!cancelled) {
          setEntities(list);
          if (selectedEntity && !list.some(e => e.id === selectedEntityId)) {
            setSelectedEntityId("");
            setEntity(null);
            setSessionJournal([]);
            setAccounts([]);
          }
        }
      } catch (err) {
        console.error("Error fetching entities:", err);
        if (!cancelled) {
          setEntities([]);
          setSelectedEntityId("");
          setEntity(null);
          setSessionJournal([]);
          setAccounts([]);
        }
      }
    })();
    return () => { cancelled = true; };
    }, [user?.uid]);

  /* 2) Hydrate selection from global context */
  useEffect(() => { 
    setSelectedEntityId(globalEntity?.id ?? "");
  }, [globalEntity?.id]);

  /* 3) Keep global context in sync */
  useEffect(() => {
    if (!selectedEntity) {
      setEntity(null);
      return;
    }
    setEntity({ id: selectedEntity.id, ruc: selectedEntity.ruc, name: selectedEntity.name });
  }, [selectedEntity, setEntity]);

  /* 4) Load journal for selected entity */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedEntityId) {
        setSessionJournal([]);
        return;
      }
      try {
        setLoadingJournal(true);
        const fetched = await fetchJournalEntries(selectedEntityId);
        if (!cancelled) setSessionJournal(fetched);
      } catch (err) {
        console.error("Error loading journal entries:", err);
        if (!cancelled) setSessionJournal([]);
      } finally {
        if (!cancelled) setLoadingJournal(false);
      }
    })();
    return () => {
      cancelled = true; };
  }, [selectedEntityId]);

  /* 5) Load merged Chart of Accounts on entity change */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedEntityId) {
        setAccounts([]);
        return;
      }
      try {
        const chart = await getEntityChart(selectedEntityId);
        if (!cancelled) setAccounts(chart);
      } catch (e) {
        console.error("Error loading chart of accounts:", e);
        if (!cancelled) setAccounts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedEntityId]);

  /* ---- Actions ---- */
  const confirmDelete = useCallback(async () => {
    if (!entityToDelete || confirmText !== entityToDelete.name) {
      alert("El nombre ingresado no coincide con la entidad seleccionada.");
      return;
    }
    try {
      await deleteEntity(entityToDelete.id);
      const remaining = entities.filter((e) => e.id !== entityToDelete.id);
      setEntities(remaining);

      if (selectedEntityId === entityToDelete.id) {
        setSelectedEntityId("");
        setEntity(null);
        setSessionJournal([]);
        setAccounts([]);
      }
      setEntityToDelete(null);
      setConfirmText("");
      alert("Entidad eliminada");
    } catch (error) {
      console.error("❌ Error al eliminar entidad:", error);
      alert("Error al eliminar entidad");
    }
  }, [confirmText, entities, entityToDelete, selectedEntityId, setEntity]);

  const handleSaveJournal = useCallback(async () => {
    if (!user?.uid || !selectedEntity || sessionJournal.length === 0) return;
    await saveJournalEntries(selectedEntity.id, sessionJournal, user.uid);
    alert("Journal guardado con éxito.");
    setSessionJournal([]);
  }, [sessionJournal, selectedEntity, user?.uid]);

  // ✅ FUNCION CORREGIDA: guarda, registra facturas y cierra modal
  const handlePreviewSave = async (entries: JournalEntry[], note: string) => {
    if (!user?.uid || !selectedEntityId) return;
    try {
      await saveJournalEntries(selectedEntityId, entries, user.uid);
      entries.forEach((e) => {
        if (e.invoice_number) saveInvoiceToLocalLog(selectedEntityId, e.invoice_number);
      });
      setShowPreviewModal(false); // cerrar modal inmediatamente
      fetchJournalEntries(selectedEntityId).then(setSessionJournal); // actualizar
    } catch (err) {
      console.error("Error al guardar asientos desde preview:", err);
    }
  };

  const handleEntityCreated = useCallback(
    async ({ ruc, name }: { ruc: string; name: string }) => {
      if (!user?.uid) return;
      await createEntity({ ruc: ruc.trim(), name: name.trim() });
      const updated = await fetchEntities(user.uid);
      setEntities(updated);
      // Try to select the one we just created
      const newlyCreated =
        updated.find((e) => e.ruc === ruc && e.name === name) ?? updated[updated.length - 1];
      if (newlyCreated) setSelectedEntityId(newlyCreated.id);
      alert("✅ Entidad creada.");
    },
    [user?.uid]
  );

  /* ------------------------------ UI ------------------------------ */
  return (
    <>
      <div className="pt-20 pb-6 max-w-screen-xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-blue-900 flex items-center">
            <span className="mr-2 text-3xl">📊</span> Contilisto Tablero de Entidades
          </h1>

          <button
            onClick={() => setShowAccountsModal(true)}
            disabled={!selectedEntityId}
            className="px-4 py-2 bg-emerald-500 text-white rounded shadow hover:bg-emerald-600 disabled:opacity-50"
            title={selectedEntityId ? "Ver / Editar Plan de Cuentas" : "Selecciona una entidad"}
          >
            Ver Plan de Cuentas
          </button>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left column: entities & actions */}
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => setShowAddEntity(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                ➕ Agregar Entidad
              </button>
            </div>

            <label htmlFor="entity-select" className="font-semibold block mb-1">
              Lista de Entidades</label>
            <select
              id="entity-select"
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              className="w-full p-2 border rounded"
              title="Seleccionar entidad"
              aria-label="Seleccionar entidad"
            >
              <option value="">- Seleccionar -</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.ruc} - {e.name}
                </option>
              ))}
            </select>

            <div className="flex flex-col gap-2 mt-3">
              {selectedEntity && (
                <button
                  onClick={() =>
                    setEntityToDelete(entities.find((e) => e.id === selectedEntityId) || null)
                  }
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded w-fit"
                >
                  ⚠️ Eliminar Entidad
                </button>
              )}

              <DevLogResetButton 
                entityId={selectedEntityId} 
                ruc={selectedEntityRUC}
                setSessionJournal={setSessionJournal} 
              />

              {selectedEntity && (
                <InvoiceLogDropdown
                  key={selectedEntityId}
                  entityId={selectedEntityId}
                  ruc={selectedEntityRUC}
                  setSessionJournal={setSessionJournal}
                />
              )}
            </div>
          </div>

          {/* Right column: actions + uploader */}
          <div className="w-full">
            <div className="w-full flex justify-center mb-3">
              <button
                onClick={() => setShowManualModal(true)}
                disabled={!selectedEntityId}
                className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 disabled:opacity-50"
                title={selectedEntityId ? "Registrar asientos manuales" : "Selecciona una entidad"}
              >
                ➕ Carga Manual
              </button>
            </div>

            {selectedEntity && selectedEntityRUC ? (
              <PDFUploader
                userRUC={selectedEntityRUC}
                entityId={selectedEntityId}
                userId={auth.currentUser?.uid ?? ""}
                accounts={accounts}
                onUploadComplete={(entries) => {
                  setPreviewEntries(entries);
                  setShowPreviewModal(true);
                }}
              />
            ) : (
              <div className="p-6 border rounded text-gray-500">
                Selecciona una entidad para habilitar la carga de PDFs.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loadingJournal && (
        <div className="text-center text-blue-600 font-medium mt-4 animate-pulse">
          ⏳ Cargando registros contables de la entidad...
        </div>
      )}

      {/* Journal + AR/AP */}
      {!loadingJournal && sessionJournal.length > 0 && (
        <>
          <JournalTable
            entries={sessionJournal}
            entityName={selectedEntity?.name ?? ""}
            onSave={handleSaveJournal}
          />
        {/*  <AccountsReceivablePayable entries={journal} /> */}
        </>
      )}

      {/* Empty state when no entries */}
      {!loadingJournal && selectedEntityId && sessionJournal.length === 0 && (
        <div className="max-w-screen-xl mx-auto mt-6 text-center text-gray-500">
          No hay registros aún. Sube PDFs o crea asientos manuales.
        </div>
      )}

      {/* Confirm delete modal */}
      {entityToDelete && (
        <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white p-6 rounded shadow-md max-w-sm w-full">
            <h2 className="text-lg font-bold text-red-700 mb-2">Confirmar eliminación</h2>
            <p className="text-sm mb-2">Escribe el nombre exacto para confirmar:</p>
            <input
              type="text"
              className="border px-2 py-1 rounded w-full"
              placeholder="Nombre de la entidad"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setEntityToDelete(null)}
                className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1 rounded bg-red-700 text-white hover:bg-red-800"
              >
                🗑️ Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAccountsModal && selectedEntityId && (
        <ChartOfAccountsModal
          onClose={() => setShowAccountsModal(false)}
          entityId={selectedEntityId}
          accounts={accounts}
          onUploadComplete={(entries) => setSessionJournal((prev) => [...prev, ...entries])}     // immediate render with merged chart
        />
      )}

      {showManualModal && selectedEntityId && (
        <ManualEntryModal
          onClose={() => setShowManualModal(false)}
          entityId={selectedEntityId}
          userId={auth.currentUser?.uid ?? ""}
          onAddEntries={(entries) =>
            setSessionJournal((prev) => [...prev, ...entries])
          }
          // ManualEntryModal can use its own fetch OR use accounts prop if you add it
          accounts={accounts}
        />
      )}
    <AddEntityModal
      isOpen={showAddEntity}
      onClose={() => setShowAddEntity(false)}
      onCreate={handleEntityCreated}
    />
    {showPreviewModal && (
      <JournalPreviewModal
        entries={previewEntries}
        accounts={accounts}
        entityId={selectedEntityId}
        userId={user?.uid ?? ""}
        onClose={() => setShowPreviewModal(false)}
        onSave={(withNote, note) => {
          setSessionJournal((prev) => [...prev, ...withNote]);
          setShowPreviewModal(false);
        }}
      />
    )}
    </>
  );
}
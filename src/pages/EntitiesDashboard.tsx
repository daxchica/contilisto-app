// src/pages/EntitiesDashboard.tsx
import { useEffect, useState, useMemo } from "react";
import { useSelectedEntity } from "../context/SelectedEntityContext";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase-config";

import PDFUploader from "../components/PDFUploader";
import JournalTable from "../components/JournalTable";
import AccountsReceivablePayable from "../components/AccountsReceivablePayable";

import { createEntity, deleteEntity, fetchEntities } from "../services/entityService";
import { fetchJournalEntries, deleteJournalEntriesByInvoiceNumber, saveJournalEntries } from "../services/journalService";
import {
  clearLocalLogForEntity,
  deleteInvoicesFromLocalLog,
  getProcessedInvoices,
} from "../services/localLogService";
import {
  deleteInvoicesFromFirestoreLog,
  clearFirestoreLogForEntity,
} from "../services/firestoreLogService";
import { JournalEntry } from "../types/JournalEntry";

import ChartOfAccountsModal from "../components/ChartOfAccountsModal";
import { Account } from "../types/AccountTypes";
// Optional: quick navigation (uncomment if you want buttons to other pages)
// import { useNavigate } from "react-router-dom";

function DevLogResetButton({ entityId, ruc }: { entityId: string; ruc: string }) {
  if (!entityId || !ruc) return null;

  const handleReset = async () => {
    const confirm = window.confirm(
      "¿Estás seguro de que deseas borrar todos los logs procesados?"
    );
    if (!confirm) return;

    await clearFirestoreLogForEntity(entityId);
    clearLocalLogForEntity(ruc);
    alert("✔️ Todos los logs procesados han sido eliminados.");
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

function InvoiceLogDropdown({
  entityId,
  ruc,
  setJournal,
}: {
  entityId: string;
  ruc: string;
  setJournal: React.Dispatch<React.SetStateAction<JournalEntry[]>>;
}) {
  const [invoices, setInvoices] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (entityId && ruc) {
      const invs = Array.from(getProcessedInvoices(ruc));
      setInvoices(invs);
      setSelected(new Set());
    }
  }, [entityId, ruc ]);

  const toggleInvoice = (invoice: string) => {
    const next = new Set(selected);
    next.has(invoice) ? next.delete(invoice) : next.add(invoice);
    setSelected(next);
  };

  const handleDeleteSelected = async () => {
    const confirm = window.confirm("¿Borrar las facturas seleccionadas del log?");
    if (!confirm) return;

    const toDelete = Array.from(selected);

    await deleteInvoicesFromFirestoreLog(entityId, toDelete);
    deleteInvoicesFromLocalLog(ruc, toDelete);
    await deleteJournalEntriesByInvoiceNumber(entityId, toDelete);

    setInvoices((prev) => prev.filter((inv) => !toDelete.includes(inv)));
    setSelected(new Set());

    setJournal((prev) =>
      prev.filter((entry) => !toDelete.includes((entry.invoice_number ?? "").trim())));
    alert("🗑️ Facturas seleccionadas eliminadas del log.");
  };

  if (!invoices.length) return null;

  return (
    <div className="mt-4 p-4 bg-white border rounded shadow">
      <h3 className="font-bold mb-2">🧾 Facturas procesadas</h3>
      <ul className="max-h-40 overflow-y-auto">
        {invoices.map((inv) => (
          <li key={inv} className="flex items-center gap-2 mb-1">
            <input
              type="checkbox"
              aria-label={`Seleccionar factura ${inv}`}
              checked={selected.has(inv)}
              onChange={() => toggleInvoice(inv)}
            />
            <span className="text-sm text-gray-700">{inv}</span>
          </li>
        ))}
      </ul>
      <button
        disabled={selected.size === 0}
        onClick={handleDeleteSelected}
        className="mt-2 bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 w-fit"
      >
        🗑️ Borrar seleccionadas
      </button>
    </div>
  );
}

export default function EntitiesDashboard() {
  const [user] = useAuthState(auth);
  const [ruc, setRuc] = useState("");
  const [name, setName] = useState("");
  const [entities, setEntities] = useState<{ id: string; ruc: string; name: string }[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState("");

  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [loadingJournal, setLoadingJournal] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState< {id: string; ruc: string; name: string} | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const { entity: globalEntity, setEntity } = useSelectedEntity();
  
  const selectedEntity = useMemo(
    () => entities.find((e) => e.id === selectedEntityId) ?? null,
    [selectedEntityId, entities]
  );
  const selectedEntityRUC = selectedEntity?.ruc ?? "";
  
  // 1) Fetch entities for the logged-in user
  useEffect(() => {
    const load = async () => {
    if (!user?.uid) {
      setEntities([]);
      setSelectedEntityId("");
      setEntity(null);
      return;
    }
    try {
      // Pass userId consistently
      const list = await fetchEntities(user.uid);
      setEntities(list);
      
      // If current selection is not in the refreshed list, clear it
      if (selectedEntityId && !list.some((e) => e.id === selectedEntityId)) {
        setSelectedEntityId("");
        setEntity(null);
    }
  } catch (err) {
    console.error("Error fetching entities:", err);
  }
};
load();
// eslint-disable-next-line react-hooks-exhaustive-deps
}, [user?.uid]);

  // 2) Hydrate local selection from global context on mount / when it changes
  useEffect(() => {
      if (globalEntity?.id) setSelectedEntityId(globalEntity.id);
      else setSelectedEntityId("");
  }, [globalEntity?.id]);

  // 3) Keep global context in sync when selection changes locally
  useEffect(() => {
    if (!selectedEntity) {
      setEntity(null);
      return;
    }
    setEntity({ id: selectedEntity.id, ruc: selectedEntity.ruc, name: selectedEntity.name });
  }, [selectedEntityId, entities, setEntity]);

  // 4) Load journal for the selected entity
  useEffect(() => {
    const loadJournal = async () => {
      if (!selectedEntityId) {
        setJournal([]);
        return;
      }
      try {
        setLoadingJournal(true);
        const fetched = await fetchJournalEntries(selectedEntityId);
        setJournal(fetched);
      } catch (err) {
        console.error("Error loading journal entries:", err);
      } finally {
        setLoadingJournal(false);
      }
    };
    loadJournal();
  }, [selectedEntityId]);

  const handleAddEntity = async () => {
    if (!user?.uid || !ruc || !name) {
      alert("Por favor, completa todos los campos antes de continuar.");
      return;
    }

    const confirmed = window.confirm(
      `¿Estás seguro de que deseas registrar la nueva entidad con los siguientes datos?\n\nRUC: ${ruc}\nNombre: ${name}`
    );
    if (!confirmed) return;

    try {
      await createEntity(user.uid, ruc, name);
      const updated = await fetchEntities(user.uid);
      setEntities(updated);
      setRuc("");
      setName("");
      alert("✅ Entidad creada con éxito.");
    } catch (error: any) {
      console.error("❌ Error al crear entidad:", error);
      alert("❌ Hubo un error al crear la entidad. Revisa la consola para más detalles.");
    }
  };

  const confirmDelete = async () => {
    if (!entityToDelete || confirmText !== entityToDelete.name) {
      alert("El nombre ingresado no coincide con el de la entidad seleccionada.");
      return;
    }
    try {
      await deleteEntity(entityToDelete.id);
      const remaining = entities.filter((e) => e.id !== entityToDelete.id);
      setEntities(remaining);

      if ( selectedEntityId === entityToDelete.id) {
        setSelectedEntityId("");
        setGlobalEntity(null);
        setJournal([]);
      }
      setEntityToDelete(null);
      setConfirmText("");
      alert("Entidad eliminada");
    } catch (error) {
      alert("Error al eliminar entidad");
      console.error("❌ Error al eliminar entidad:", error);
    }
  };

  const handleSaveJournal = async () => {
    if (!user?.uid || !selectedEntity) return;
    await saveJournalEntries(selectedEntity.id, journal, user.uid);
    alert("Journal guardado con exito.");
  };

  // Construir cuentas desde el diario
  const accountsFromJournal: Account[] = useMemo(() => {
    const map = new Map<string, string>(); // code -> name
    for (const e of journal) {
      const code = (e.account_code ?? "").toString().trim();
      const name = (e.account_name ?? "").toString().trim();
      if (code && name && !map.has(code)) map.set(code, name);
    }
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.code.localeCompare(b.code, "es"));
  }, [journal]);

  return (
    <>
      <div className="pt-20 pb-6 max-w-screen-xl mx-auto">
        <h1 className="text-2xl font-bold text-blue-900 flex items-center mb-4">
          <span className="mr-2 text-3xl">📊</span> Contilisto Tablero de Entidades
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <input
                type="text"
                placeholder="Ingresa el RUC"
                value={ruc}
                onChange={(e) => setRuc(e.target.value)}
                className="border p-2 rounded w-[140px]"
              />
              <input
                type="text"
                placeholder="Ingresa Nombre de Empresa"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border p-2 rounded flex-grow"
              />
              <button
                onClick={handleAddEntity}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                ➕ Agregar Registro
              </button>
            </div>

            <label className="font-semibold block mb-1">Lista de Empresas</label>
            <select
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
                    setEntityToDelete(
                      entities.find((e) => e.id === selectedEntityId) || null)
                  }
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded w-fit"
                >
                  ⚠️ Eliminar Entidad
                </button>
              )}

              {process.env.NODE_ENV === "development" && selectedEntity && (
                <DevLogResetButton
                  entityId={selectedEntityId}
                  ruc={selectedEntityRUC}
                />
              )}

              {selectedEntity && (
                <button
                  onClick={() => setShowAccountsModal(true)}
                  className="px-4 py-2 bg-gray-100 border rounded text-blue-700 hover:bg-gray-200 w-fit"
                >
                  VER Plan de Cuentas
                </button>
              )}

              {/* Optional quick navigation
              {selectedEntityId && (
                <div className="flex gap-2 mt-2">
                  <button
                    className="px-3 py-1 border rounded hover:bg-gray-100"
                    onClick={() => navigate("/libroBancos")}
                  >
                    Ir a Libro Bancos
                  </button>
                  <button
                    className="px-3 py-1 border rounded hover:bg-gray-100"
                    onClick={() => navigate("/libro-mayor")}
                  >
                    Ir a Libro Mayor
                  </button>
                </div>
              )}
              */}

              {entityToDelete && (
                <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-40 z-50">
                  <div className="bg-white p-6 rounded shadow-md max-w-sm w-full">
                    <h2 className="text-lg font-bold text-red-700 mb-2">
                      Confirmar eliminación
                    </h2>
                    <p className="text-sm mb-2">
                      Escribe el nombre exacto para confirmar:
                    </p>
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

              {selectedEntity && (
                <InvoiceLogDropdown
                  key={selectedEntityId}
                  entityId={selectedEntityId}
                  ruc={selectedEntityRUC}
                  setJournal={setJournal}
                />
              )}
            </div>
          </div>

          {selectedEntity && selectedEntityRUC && (
            <PDFUploader
              userRUC={selectedEntityRUC}
              entityId={selectedEntityId}
              userId={auth.currentUser?.uid ?? ""}
              onUploadComplete={(entries) =>
                setJournal((prev) => [...prev, ...entries])
              }
            />
          )}
        </div>
      </div>

      {loadingJournal && (
        <div className="text-center text-blue-600 font-medium mt-4 animate-pulse">
          ⏳ Cargando registros contables de la entidad...
        </div>
      )}

      {!loadingJournal && journal.length > 0 && (
        <>
          <JournalTable
            entries={journal}
            entityName={selectedEntityId}
            onSave={handleSaveJournal}
          />
          <AccountsReceivablePayable entries={journal} />
        </>
      )}

      {showAccountsModal && (
        <ChartOfAccountsModal
          accounts={accountsFromJournal}
          onClose={() => setShowAccountsModal(false)}
        />
      )}
    </>
  );
}
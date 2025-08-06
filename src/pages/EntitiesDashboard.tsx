import { useEffect, useState, useMemo } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase-config";

import PnLSummary from "../components/PnLSummary";
import PDFUploader from "../components/PDFUploader";
import JournalTable from "../components/JournalTable";
import InitialBalancePanel from "../components/InitialBalancePanel";
import BalanceSheetDisplay from "../components/BalanceSheetDisplay";
import AccountsReport from "../components/AccountsReport";
import BankMovementForm from "../components/BankMovementForm";
import AccountsReceivablePayable from "../components/AccountsReceivablePayable";

import { createEntity, deleteEntity, fetchEntities } from "../services/entityService";
import { fetchJournalEntries, deleteJournalEntriesByInvoiceNumber, saveJournalEntries } from "../services/journalService";
import { clearLocalLogForEntity, deleteInvoicesFromLocalLog, getProcessedInvoices } from "../services/localLogService";
import { deleteInvoicesFromFirestoreLog, clearFirestoreLogForEntity } from "../services/firestoreLogService";
import { JournalEntry } from "../types/JournalEntry";

function DevLogResetButton({ entityId, ruc }: { entityId: string; ruc: string }) {
  if (!entityId || !ruc) return null;

  const handleReset = async () => {
    const confirm = window.confirm("¿Estás seguro de que deseas borrar todos los logs procesados?");
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

function InvoiceLogDropdown({ entityId, ruc, journal, setJournal }: { entityId: string; ruc: string; journal: JournalEntry[]; setJournal: React.Dispatch<React.SetStateAction<JournalEntry[]>>; }) {
  const [invoices, setInvoices] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (entityId && ruc) {
      const invoices = Array.from(getProcessedInvoices(ruc));
      setInvoices(invoices);
    }
  }, [entityId, ruc, journal]);

  const toggleInvoice = (invoice: string) => {
    const newSet = new Set(selected);
    newSet.has(invoice) ? newSet.delete(invoice) : newSet.add(invoice);
    setSelected(newSet);
  };

  const handleDeleteSelected = async () => {
    const confirm = window.confirm("¿Borrar las facturas seleccionadas del log?");
    if (!confirm) return;

    const toDelete = Array.from(selected);

    await deleteInvoicesFromFirestoreLog(entityId, toDelete);
    deleteInvoicesFromLocalLog(ruc, toDelete);
    await deleteJournalEntriesByInvoiceNumber(entityId, toDelete);

    setInvoices(invoices.filter((inv) => !toDelete.includes(inv)));
    setSelected(new Set());

    setJournal((prev) => prev.filter((entry) => !toDelete.includes((entry.invoice_number ?? "").trim())));
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
  const [selectedEntity, setSelectedEntity] = useState("");
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [loadingJournal, setLoadingJournal] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState<any>(null);
  const [confirmText, setConfirmText] = useState("");

  const selectedEntityObj = useMemo(() => entities.find((e) => e.id === selectedEntity), [selectedEntity, entities]);
  const selectedEntityRUC = selectedEntityObj?.ruc ?? "";

  useEffect(() => {
    if (user) {
      fetchEntities(user).then(setEntities).catch((err) => console.error("Error fetching entities:", err));
    }
  }, [user]);

  useEffect(() => {
    const loadJournal = async () => {
      if (selectedEntity) {
        try {
          setLoadingJournal(true);
          const fetched = await fetchJournalEntries(selectedEntity);
          setJournal(fetched);
        } catch (err) {
          console.error("Error loading journal entries:", err);
        } finally {
          setLoadingJournal(false);
        }
      } else {
        setJournal([]);
      }
    };
    loadJournal();
  }, [selectedEntity]);

  const handleAddEntity = async () => {
    if (!user || !ruc || !name) {
      alert("Por favor, completa todos los campos antes de continuar.");
      return;
    }

    const confirmed = window.confirm(`¿Estás seguro de que deseas registrar la nueva entidad con los siguientes datos?\n\nRUC: ${ruc}\nNombre: ${name}`);
    if (!confirmed) return;

    try {
      await createEntity(user, ruc, name);
      const updated = await fetchEntities(user);
      setEntities(updated);
      setRuc("");
      setName("");
      alert("✅ Entidad creada con éxito.");
    } catch (error: any) {
      console.error("❌ Error al crear entidad:", error);
      if (error.message.includes("already exists")) {
        alert("❌ Hubo un error al crear la entidad. Revisa la consola para más detalles.");
      }
    }
  };

  const confirmDelete = async () => {
    if (!entityToDelete || confirmText !== entityToDelete.name) {
      alert("El nombre ingresado no coincide con el de la entidad seleccionada.");
      return;
    }
    try {
      await deleteEntity(entityToDelete.id);
      setEntities(entities.filter(e => e.id !== entityToDelete.id));
      setSelectedEntity("");
      setEntityToDelete(null);
      setConfirmText("");
      alert("Entidad eliminada");
    } catch (error) {
      alert("Error al eliminar entidad");
      console.error("❌ Error al eliminar entidad:", error);
    }
  };

  const handleSaveJournal = async () => {
    if (!user || !selectedEntityObj) return;
    await saveJournalEntries(selectedEntityObj.id, journal, user.uid);
    alert("Journal guardado con exito.");
  };

  return (
    <div className="p-4 max-w-screen-xl mx-auto">
      <h1 className="text-2xl font-bold text-blue-900 flex items-center mb-4">
        <span className="mr-2 text-3xl">📊</span> Contilisto Tablero de Entidades
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            <input type="text" placeholder="Ingresa el RUC" value={ruc} onChange={(e) => setRuc(e.target.value)} className="border p-2 rounded w-[140px]" />
            <input type="text" placeholder="Ingresa Nombre de Empresa" value={name} onChange={(e) => setName(e.target.value)} className="border p-2 rounded flex-grow" />
            <button onClick={handleAddEntity} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">➕ Agregar Registro</button>
          </div>

          <label className="font-semibold block mb-1">Lista de Empresas</label>
          <select value={selectedEntity} onChange={(e) => setSelectedEntity(e.target.value)} className="w-full p-2 border rounded" title="Seleccionar entidad" aria-label="Seleccionar entidad">
            <option value="">- Seleccionar -</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>{e.ruc} - {e.name}</option>
            ))}
          </select>

          <div className="flex flex-col gap-2 mt-3">
            {selectedEntity && (
              <button
                onClick={() => setEntityToDelete(entities.find(e => e.id === selectedEntity))}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded w-fit"
              >
                ⚠️ Eliminar Entidad
              </button>
            )}

            {process.env.NODE_ENV === "development" && selectedEntity && (
              <DevLogResetButton entityId={selectedEntity} ruc={selectedEntityRUC} />
            )}
          </div>

          {entityToDelete && (
            <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-40 z-50">
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
                  <button onClick={() => setEntityToDelete(null)} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300">Cancelar</button>
                  <button onClick={confirmDelete} className="px-3 py-1 rounded bg-red-700 text-white hover:bg-red-800">🗑️ Eliminar</button>
                </div>
              </div>
            </div>
          )}

          {selectedEntity && (
            <>
              <InvoiceLogDropdown key={selectedEntity} entityId={selectedEntity} ruc={selectedEntityRUC} journal={journal} setJournal={setJournal} />
              <BankMovementForm entityId={selectedEntity} />
            </>
          )}
        </div>

        {selectedEntity && selectedEntityRUC && (
          <PDFUploader
            userRUC={selectedEntityRUC}
            entityId={selectedEntity}
            userId={auth.currentUser?.uid ?? ""}
            onUploadComplete={(entries) => setJournal((prev) => [...prev, ...entries])}
          />
        )}
      </div>

      <InitialBalancePanel />

      {loadingJournal && (
        <div className="text-center text-blue-600 font-medium mt-4 animate-pulse">
          ⏳ Cargando registros contables de la entidad...
        </div>
      )}

      {!loadingJournal && journal.length > 0 && (
        <>
          <JournalTable entries={journal} entityName={selectedEntity} onSave={handleSaveJournal} />
          <AccountsReceivablePayable entries={journal} />
        </>
      )}
    </div>
  );
}
// ... (importaciones)
import PnLSummary from "../components/PnLSummary";
import { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase-config";
import PDFUploader from "../components/PDFUploader";
import JournalTable from "../components/JournalTable";
import { createEntity, fetchEntities } from "../services/entityService";
import { JournalEntry } from "../utils/accountMapper";
import InitialBalancePanel from "../components/InitialBalancePanel";
import ManualBalanceForm from "../components/ManualBalanceForm";
import BalancePDFUploader from "../components/BalancePDFUploader";
import BalanceSheetDisplay from "../components/BalanceSheetDisplay";
import InvoiceSearch from "../components/InvoiceSearch";
import { clearFirestoreLogForEntity } from "../services/firestoreLogService";
import { clearLocalLogForEntity } from "../services/localLogService";

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
      className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
    >
      🧹 Borrar logs de facturas procesadas (DEV)
    </button>
  );
}

export default function EntitiesDashboard() {
  const [user] = useAuthState(auth);
  const [ruc, setRuc] = useState("");
  const [name, setName] = useState("");
  const [entities, setEntities] = useState<{ id: string; ruc: string; name: string }[]>([]);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [invoicePreview, setInvoicePreview] = useState("");

  useEffect(() => {
    if (user) {
      fetchEntities(user).then(setEntities);
    }
  }, [user]);

  const handleAddEntity = async () => {
    if (!user || !ruc || !name) return;
    await createEntity(user, ruc, name);
    const updated = await fetchEntities(user);
    setEntities(updated);
    setRuc("");
    setName("");
  };

  const handleSaveJournal = async () => {
    const entity = entities.find((e) => e.id === selectedEntity);
    if (!entity) return;
    const { saveJournalEntries } = await import("../services/journalService");
    await saveJournalEntries(entity.id, journal);
    alert("Journal saved successfully!");
  };

  const selectedEntityRUC = entities.find(e => e.id === selectedEntity)?.ruc || "";

  return (
    <div className="p-4 max-w-screen-xl mx-auto">
      <h1 className="text-2xl font-bold text-blue-900 flex items-center mb-4">
        <span className="mr-2 text-3xl">📊</span> Contalisto Tablero de Entidades
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              type="text"
              placeholder="Enter RUC"
              value={ruc}
              onChange={(e) => setRuc(e.target.value)}
              className="border p-2 rounded w-[140px]"
            />
            <input
              type="text"
              placeholder="Enter Name"
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

          <label className="font-semibold block mb-1">Selecciona Empresa</label>
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">- Selecciona -</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.ruc} - {e.name}
              </option>
            ))}
          </select>

          {process.env.NODE_ENV === "development" && selectedEntity && (
            <DevLogResetButton 
              entityId={selectedEntity} 
              ruc={selectedEntityRUC} 
            />
          )}
        </div>

        <PDFUploader
          userRUC={selectedEntityRUC}
          entityId={selectedEntity}
          onUploadComplete={(entries, preview) => {
            setJournal((prev) => [...prev, ...entries]);
            setInvoicePreview(preview);
          }}
        />

        {selectedEntity && (
          <InvoiceSearch userRUC={selectedEntityRUC} />
        )}
      </div>

      <InitialBalancePanel />
      <JournalTable 
        entries={journal} 
        entityName={selectedEntity}
        onSave={handleSaveJournal} 
      />
      {journal.length > 0 && <PnLSummary entries={journal} />}
      {journal.length > 0 && <BalanceSheetDisplay entries={journal}/>}
    </div>
  );
}
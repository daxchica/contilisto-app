// ============================================================
// src/pages/EntitiesDashboard.tsx — ARQUITECTURA CONTILISTO v1.0
// Flujo: Selección de empresa → Carga PDF → OCR+Vision (backend)
//       → JournalPreviewModal (autoclaseo + edición) → Guardado
// ============================================================

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase-config";
import { useSelectedEntity } from "../context/SelectedEntityContext";

import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

import JournalTable from "../components/JournalTable";
import ManualEntryModal from "../components/ManualEntryModal";
import ChartOfAccountsModal from "../components/ChartOfAccountsModal";
import AddEntityModal from "../components/AddEntityModal";
import JournalPreviewModal from "../components/JournalPreviewModal";
import PDFDropzone from "../components/PDFDropzone";

import { extractInvoiceVision } from "../services/extractInvoiceVisionService";

import type { Account } from "../types/AccountTypes";
import type { JournalEntry } from "../types/JournalEntry";
import type { Entity } from "../types/Entity";

import { createEntity, fetchEntities } from "../services/entityService";
import { saveJournalEntries } from "@/services/journalService";

import {
  deleteInvoicesFromFirestoreLog,
  clearFirestoreLogForEntity,
  fetchProcessedInvoice,
} from "../services/firestoreLogService";

import {
  clearLocalLogForEntity,
  deleteInvoicesFromLocalLog,
  getProcessedInvoices,
  logProcessedInvoice,
} from "../services/localLogService";

import { fetchCustomAccounts } from "../services/chartOfAccountsService";
import ECUADOR_COA from "../../shared/coa/ecuador_coa";

/* ============================================================
 * Utility: Convert file to BASE64 (PDF → base64 string)
 * [ACv1] Se mantiene simple porque el troceo/vision se hace en el backend.
 * ============================================================ */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(String(reader.result).replace(/^data:.*;base64,/, ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ============================================================
 * Dev-only: Reset logs
 * ============================================================ */
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

/* ============================================================
 * Facturas procesadas (Log local + Firestore)
 * ============================================================ */
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

  const handleDeleteSelected = useCallback(async () => {
    if (!selected.size) {
      alert("⚠️ Selecciona al menos una factura.");
      return;
    }

    if (!window.confirm("¿Deseas eliminar los registros seleccionados?")) return;

    const toDelete = Array.from(selected);

    try {
      await deleteInvoicesFromFirestoreLog(entityId, toDelete);
      deleteInvoicesFromLocalLog(ruc, toDelete);

      setInvoices((prev) => prev.filter((inv) => !toDelete.includes(inv)));
      setSelected(new Set());
      onDelete();
      alert("✔️ Registros eliminados.");
    } catch (err) {
      console.error("❌ Error eliminando facturas:", err);
      alert("Error en Firestore.");
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
            />
            <span className="text-sm">{inv}</span>
          </li>
        ))}
      </ul>

      <button
        disabled={selected.size === 0}
        onClick={handleDeleteSelected}
        className="mt-2 bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
      >
        🗑️ Borrar seleccionadas
      </button>
    </div>
  );
}

/* ============================================================
 * MAIN PAGE — ENTITIES DASHBOARD
 * ============================================================ */
export default function EntitiesDashboard() {
  const [user] = useAuthState(auth);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState("");

  const [sessionJournal, setSessionJournal] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // PREVIEW MODAL STATES
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewEntries, setPreviewEntries] = useState<JournalEntry[]>([]);
  const [previewMetadata, setPreviewMetadata] = useState<any>(null);

  const [selectedEntries, setSelectedEntries] = useState<JournalEntry[]>([]);

  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showAddEntity, setShowAddEntity] = useState(false);

  const [logRefreshTrigger, setLogRefreshTrigger] = useState(0);
  const [loadingJournal] = useState(false);

  const { entity: globalEntity, setEntity } = useSelectedEntity();

  /* ============================================================
   * Load Entities (REAL)
   * ============================================================ */
  useEffect(() => {
    if (!user?.uid) {
      setEntities([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        console.log("🔍 Cargando empresas del usuario:", user.uid);
        const list = await fetchEntities(user.uid);
        if (!cancelled) {
          setEntities(list);
          console.log("📌 Empresas cargadas:", list);
        }
      } catch (err) {
        console.error("❌ Error cargando entidades:", err);
        setEntities([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  /* ============================================================
   * Derived
   * ============================================================ */
  const currentEntity = useMemo(
    () => entities.find((e) => e.id === selectedEntityId) ?? null,
    [selectedEntityId, entities]
  );

  const selectedEntityIdSafe = selectedEntityId || "";
  const currentEntityRUC = currentEntity?.ruc ?? "";
  const currentEntityType = currentEntity?.type ?? "servicios";
  const userIdSafe = user?.uid ?? auth.currentUser?.uid ?? "";

  /* ============================================================
   * Sync global entity (context)
   * ============================================================ */
  useEffect(() => {
    setSelectedEntityId(globalEntity?.id ?? "");
  }, [globalEntity?.id]);

  useEffect(() => {
    if (currentEntity) {
      setEntity({
        id: currentEntity.id ?? "",
        ruc: currentEntity.ruc ?? "",
        name: currentEntity.name ?? "",
        type: currentEntity.type ?? "servicios",
      });
    } else {
      setEntity(null);
    }
  }, [currentEntity, setEntity]);

  /* ============================================================
   * Load accounts (PUC oficial + custom)
   * [ACv1] Usado por JournalPreviewModal y ManualEntryModal
   * ============================================================ */
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
      console.log(`📘 Cuentas cargadas: ${merged.length}`);
    } catch (err) {
      console.error("❌ Error loading accounts:", err);
      setAccounts([]);
    }
  }, [selectedEntityId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  /* ============================================================
   * Delete Selected (JournalTable) — pendiente integración
   * [ACv1] De momento deshabilitado para no romper flujo.
   * ============================================================ */
  const handleDeleteSelected = useCallback(async () => {
    alert("⚠ Función de eliminar asientos seleccionados está deshabilitada temporalmente.");
  }, []);

  /* ============================================================
   * Handler: Carga MANUAL agregada
   * [ACv1] Punto de enganche futuro para refrescar tabla.
   * ============================================================ */
  const handleManualEntriesAdded = useCallback(async () => {
    // TODO [ACv1]: integrar con fetchJournalEntries(entityId) cuando se active historico.
  }, []);

  /* ============================================================
   * Handler: PDF procesado → invoca OCR+Vision backend
   * [ACv1] Firma compatible con PDFDropzone: FileList | null
   * ============================================================ */
  const handlePdfFilesSelected = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (!currentEntityRUC) {
        alert("Selecciona una entidad antes de cargar un PDF.");
        return;
      }

      const fileArray = Array.from(files);
      const file = fileArray[0];

      const base64 = await fileToBase64(file);

      try {
        const data = await extractInvoiceVision(
          base64,
          currentEntityRUC,
          currentEntityType
        );

        if (!data) {
          alert("No se obtuvo respuesta del motor OCR+Vision.");
          return;
        }

        // [ACv1] Validación de duplicado ANTES del modal (log local)
        if (data.invoice_number) {
          const already = getProcessedInvoices(currentEntityRUC);
          if (already.has(data.invoice_number)) {
            const proceed = window.confirm(
              `⚠️ La factura ${data.invoice_number} ya fue procesada para esta empresa.\n\n¿Deseas volver a cargarla de todos modos?`
            );
            if (!proceed) return;
          }
        }

        // [ACv1] Guardamos metadata COMPLETA (cruda), no sólo campos sueltos
        setPreviewMetadata({
          ...data,
          entityRUC: currentEntityRUC,
          entityType: currentEntityType,
        });

        // [ACv1] Entries desde el backend:
        setPreviewEntries(Array.isArray(data.entries) ? data.entries : []);

        setShowPreviewModal(true);
      } catch (err) {
        console.error("❌ Error procesando PDF con OCR+Vision:", err);
        alert(
          "Hubo un error procesando la factura. Revisa la consola para más detalles."
        );
      }
    },
    [currentEntityRUC, currentEntityType]
  );

  /* ============================================================
   * UI
   * ============================================================ */
  return (
    <>
      {/* NAVBAR */}
      <NavBar />

      {/* WRAPPER GLOBAL — evita que la NavBar tape el contenido */}
      <div className="pt-20 p-4">

        {/* MAIN CONTENT */}
        <main className="pb-6 max-w-screen-xl mx-auto px-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-blue-900 flex items-center">
              <span className="mr-2 text-3xl">📊</span> Contilisto Tablero de Entidades
            </h1>

            <button
              onClick={() => setShowAccountsModal(true)}
              disabled={!selectedEntityId}
              className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50"
            >
              📚 Ver Plan de Cuentas
            </button>
          </div>

          {/* Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* LEFT */}
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
                ruc={currentEntityRUC}
                onReset={() => setLogRefreshTrigger((p) => p + 1)}
              />

              {selectedEntityIdSafe && currentEntityRUC && (
                <InvoiceLogDropdown
                  entityId={selectedEntityId}
                  ruc={currentEntityRUC}
                  onDelete={() => setLogRefreshTrigger((p) => p + 1)}
                  logRefreshTrigger={logRefreshTrigger}
                />
              )}
            </div>

            {/* RIGHT */}
            <div>
              <button
                onClick={() => setShowManualModal(true)}
                disabled={!selectedEntityId}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 mb-3"
              >
                ➕ Carga Manual
              </button>

              {selectedEntityIdSafe && currentEntityRUC ? (
                <PDFDropzone
                  disabled={false}
                  onFilesSelected={handlePdfFilesSelected}
                />
              ) : (
                <div className="p-6 border-2 border-dashed rounded text-gray-500 text-center bg-gray-50">
                  Selecciona una entidad para habilitar la carga de PDFs.
                </div>
              )}
            </div>
          </div>
        </main>

        {/* JOURNAL TABLE — vista de asientos ya cargados en sesión */}
        {!loadingJournal && sessionJournal.length > 0 && (
          <JournalTable
            entries={sessionJournal}
            entityName={currentEntity?.name ?? ""}
            onDeleteSelected={handleDeleteSelected}
            onSelectEntries={setSelectedEntries}
            onSave={() => {}}
          />
        )}

        {/* MODALS */}
        {showAccountsModal && selectedEntityId && (
          <ChartOfAccountsModal
            entityId={selectedEntityIdSafe}
            onClose={() => setShowAccountsModal(false)}
            accounts={accounts}
            onUploadComplete={loadAccounts}
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

        {/* =======================================================
        * JOURNAL PREVIEW MODAL
        * [ACv1] Recibe:
        *  - entries: propuestos por OCR+Vision/backend
        *  - metadata: incluye issuer, RUC, montos, raw_text, etc.
        *  - accounts: plan de cuentas unificado
        *  - onSave: guarda asientos y actualiza logs
        * ======================================================= */}
        {showPreviewModal && (
          <JournalPreviewModal
            key={`${selectedEntityId}-${logRefreshTrigger}`}
            entries={previewEntries}
            metadata={previewMetadata}
            accounts={accounts}
            entityId={selectedEntityIdSafe}
            userId={userIdSafe}
            onClose={() => {
              setShowPreviewModal(false);
              setPreviewEntries([]);
            }}
            onSave={async (entries, note) => {
              // Guardar en Firestore
              await saveJournalEntries(selectedEntityIdSafe, entries, userIdSafe);

              // [ACv1] Actualizar sesión local (JournalTable)
              setSessionJournal((prev) => [...prev, ...entries]);

              // Registrar factura como procesada (log local + firestore)
              const invoiceNumbers = entries
                .map((e) => e.invoice_number)
                .filter((n): n is string => !!n);

              for (const num of invoiceNumbers) {
                await fetchProcessedInvoice(selectedEntityIdSafe, num);
                logProcessedInvoice(currentEntityRUC, num);
              }

              setLogRefreshTrigger((p) => p + 1);

              alert("Asientos guardados correctamente.");
              setShowPreviewModal(false);
              setPreviewEntries([]);
            }}
          />
        )}

        {/* MODAL — CREAR EMPRESA */}
        <AddEntityModal
          isOpen={showAddEntity}
          onClose={() => setShowAddEntity(false)}
          onCreate={async ({ ruc, name, entityType }) => {
            if (!userIdSafe) return;

            await createEntity({
              ruc: ruc.trim(),
              name: name.trim(),
              type: entityType.trim(),
            });

            const list = await fetchEntities(userIdSafe);
            setEntities(list);

            const newOne =
              list.find((e) => e.ruc === ruc) ?? list[list.length - 1];

            if (newOne?.id) setSelectedEntityId(newOne.id);

            alert("✔ Entidad creada");
          }}
        />
      </div>
      {/* FOOTER */}
      <Footer />
    </>
  );
}
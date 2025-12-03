// src/components/TestSaveAIEntriesButton.tsx

import { useState } from "react";
import { saveJournalEntries } from "../services/journalService";
import { v4 as uuidv4 } from "uuid";
import { getAuth } from "firebase/auth";
import { useSelectedEntity } from "../context/SelectedEntityContext";
import type { JournalEntry } from "../types/JournalEntry";

export default function TestSaveAIEntriesButton() {
  const { selectedEntity } = useSelectedEntity();
  const user = getAuth().currentUser;
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!selectedEntity || !user) {
      console.error("❌ Usuario o entidad no definidos");
      return;
    }

    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    const entries: JournalEntry[] = [
      {
        id: uuidv4(),
        date: today,
        account_code: "60601",
        account_name: "Compras locales",
        description: "Compra supermercado TUTI",
        debit: 20.93,
        credit: 0,
        type: "expense",
        invoice_number: "487-001-000060046",
        source: "ai",
        entityId: selectedEntity.id,
        userId: user.uid,
        createdAt: Date.now(),
      },
      {
        id: uuidv4(),
        date: today,
        account_code: "24301",
        account_name: "IVA crédito tributario",
        description: "IVA supermercado TUTI",
        debit: 1.10,
        credit: 0,
        type: "expense",
        invoice_number: "487-001-000060046",
        source: "ai",
        entityId: selectedEntity.id,
        userId: user.uid,
        createdAt: Date.now(),
      },
      {
        id: uuidv4(),
        date: today,
        account_code: "11101",
        account_name: "Caja",
        description: "Pago en efectivo supermercado TUTI",
        debit: 0,
        credit: 22.03,
        type: "expense",
        invoice_number: "487-001-000060046",
        source: "ai",
        entityId: selectedEntity.id,
        userId: user.uid,
        createdAt: Date.now(),
      },
    ];

    try {
      await saveJournalEntries(selectedEntity.id, entries, user.uid);
      console.log("✅ Asientos guardados correctamente en Firestore");
      alert("✅ Asientos AI de prueba guardados exitosamente.");
    } catch (err) {
      console.error("❌ Error al guardar asientos:", err);
      alert("❌ Ocurrió un error al guardar los asientos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className="bg-green-600 text-white font-bold px-4 py-2 rounded hover:bg-green-700"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? "Guardando..." : "💾 Guardar Asientos AI (Test)"}
    </button>
  );
}
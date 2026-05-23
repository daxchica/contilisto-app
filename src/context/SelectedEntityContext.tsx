// src/context/SelectedEntityContext.tsx

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode
} from "react";
import type { Entity } from "@/types/Entity";
import { useAuth } from "./AuthContext";
import { migratePersonalExpensesFromJournal } from "@/services/personalExpenseMigrationService";

export interface SelectedEntityContextType {
  selectedEntity: Entity | null;
  setEntity: (entity: Entity | null) => void;
};

const SelectedEntityContext = createContext<SelectedEntityContextType | null>(null);

export function SelectedEntityProvider ({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedEntity, setSelectedEntity] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      setSelectedEntity(null);
    }
  }, [user]);

  // ── Run personal-expense migration whenever an entity is selected ──────────
  // This ensures the one-time migration fires regardless of which accounting
  // page the user opens first (Libro Mayor, EERR, Procesamiento, etc.).
  // The migration is idempotent — a Firestore flag prevents re-runs.
  useEffect(() => {
    if (!selectedEntity?.id || !user?.uid) return;
    migratePersonalExpensesFromJournal(selectedEntity.id, user.uid)
      .then((count) => {
        if (count > 0) {
          console.log(
            `✅ Global migration: ${count} personal expense(s) removed from journalEntries.`
          );
        }
      })
      .catch((err) =>
        console.warn("⚠️ Personal expense migration failed:", err)
      );
  }, [selectedEntity?.id, user?.uid]);

  return (
    <SelectedEntityContext.Provider
      value={{ 
        selectedEntity, 
        setEntity: setSelectedEntity, }}
    >
      {children}
    </SelectedEntityContext.Provider>
  );
};

export function useSelectedEntity() {
  const ctx = useContext(SelectedEntityContext);
  if (!ctx) throw new Error("useSelectedEntity must be used within SelectedEntityProvider");
  return ctx;
}
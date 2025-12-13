// src/context/SelectedClientContext.tsx

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

import type { Entity } from "@/types/Entity";
import { useAuth } from "@/context/AuthContext";

/* ============================================================
 * TYPES
 * ============================================================ */

interface SelectedEntityContextType {
  selectedEntity: Entity | null;
  setEntity: (entity: Entity | null) => void;
  clearEntity: () => void;
}

/* ============================================================
 * CONTEXT
 * ============================================================ */

const SelectedEntityContext = createContext<SelectedEntityContextType | undefined>(
  undefined
);

/* ============================================================
 * PROVIDER
 * ============================================================ */

export const SelectedEntityProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  /* ------------------------------------------------------------
   * Clear entity when user changes (CRITICAL)
   * ------------------------------------------------------------ */
  useEffect(() => {
    setSelectedEntity(null);
  }, [user?.uid]);

  const setEntity = (entity: Entity | null) => {
    setSelectedEntity(entity);
  };

  const clearEntity = () => {
    setSelectedEntity(null);
  };

  return (
    <SelectedEntityContext.Provider
      value={{
        selectedEntity,
        setEntity,
        clearEntity,
      }}
    >
      {children}
    </SelectedEntityContext.Provider>
  );
};

/* ============================================================
 * HOOK
 * ============================================================ */

export const useSelectedEntity = () => {
  const context = useContext(SelectedEntityContext);
  if (!context) {
    throw new Error(
      "useSelectedEntity must be used within SelectedEntityProvider"
    );
  }
  return context;
};
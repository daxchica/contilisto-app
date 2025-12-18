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
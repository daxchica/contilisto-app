// src/context/SelectedEntityContext.tsx
import React, { createContext, useContext, useState } from "react";
import type { Entity } from "@/types/Entity";

interface SelectedEntityContextType {
  selectedEntity: Entity | null;
  setSelectedEntity: (entity: Entity | null) => void;

  entity: Entity | null;
  setEntity: (entity: Entity | null) => void;
}

export const SelectedEntityContext = createContext<SelectedEntityContextType>({
  selectedEntity: null,
  setSelectedEntity: () => {},

  entity: null,
  setEntity: () => {},
});

export const SelectedEntityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [entity, setEntity] = useState<Entity | null>(null);
    
    return (
      <SelectedEntityContext.Provider 
        value={{ 
          entity, 
          setEntity,
          
          selectedEntity: entity,
          setSelectedEntity: setEntity,
        }}
      >
        {children}
      </SelectedEntityContext.Provider>
    );
};
 

export const useSelectedEntity = () => {
  const ctx = useContext(SelectedEntityContext);

  if (!ctx) {
    throw new Error("useSelectedEntity must be used inside SelectedEntityProvider");
  }

  return ctx;
};
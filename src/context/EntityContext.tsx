// src/contexts/EntityContext.tsx
import { createContext, useState } from "react";
import type { ReactNode } from "react";
import type { Entity } from "../types/Entity";

interface EntityContextType {
    selectedEntity: Entity | null;
    setSelectedEntity: (entity: Entity | null) => void;
}

export const EntityContext = createContext<EntityContextType | null>(null);

export function EntityProvider({ children }: { children: ReactNode }) {
    const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

    return (
        <EntityContext.Provider value={{ selectedEntity, setSelectedEntity }}>
            {children}
        </EntityContext.Provider>
    );
}
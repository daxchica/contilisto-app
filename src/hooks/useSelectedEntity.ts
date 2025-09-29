// src/hooks/useSelectedEntity.ts

import { useContext } from "react";
import { EntityContext } from "../context/EntityContext";

export function useSelectedEntity() {
    const context = useContext(EntityContext);
    if (!context) {
        throw new Error("useSelectedEntity must be used within an EntityProvider");
    }
    return context;
}

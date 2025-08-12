import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type SelectedEntity = { 
    id: string; 
    ruc: string; 
    name: string; 
} | null;

type Ctx = {
  entity: SelectedEntity;
  setEntity: (e: SelectedEntity) => void;
};

const SelectedEntityContext = createContext<Ctx | undefined>(undefined);

const LS_KEY = "contilisto:selected_entity";

export const SelectedEntityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [entity, setEntity] = useState<SelectedEntity>(null);
    
    useEffect(() => {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) return;
        try { 
            const parsed = JSON.parse(raw);
            if (parsed && parsed.id) setEntity(parsed);
        } catch {}
    }, []);
 
    useEffect(() => {
    if (entity) localStorage.setItem(LS_KEY, JSON.stringify(entity));
    else localStorage.removeItem(LS_KEY);
  }, [entity]);

   const value = useMemo<Ctx>(() => ({ entity, setEntity }), [entity]);
   return <SelectedEntityContext.Provider value={value}>{children}</SelectedEntityContext.Provider>;
};

export function useSelectedEntity() {
  const ctx = useContext(SelectedEntityContext);
  if (!ctx) throw new Error("useSelectedEntity must be used within SelectedEntityProvider");
  return ctx;
}
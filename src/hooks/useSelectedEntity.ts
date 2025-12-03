// src/hooks/useSelectedEntity.ts
import { useContext } from "react";
import { SelectedEntityContext } from "@/context/SelectedEntityContext";

export const useSelectedEntity = () => {
  return useContext(SelectedEntityContext);
};
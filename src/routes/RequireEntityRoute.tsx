import React from "react";
import { Navigate } from "react-router-dom";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { useAuth } from "@/context/AuthContext";

type Props = { children: React.ReactNode };

export default function RequireEntityRoute({ children }: Props) {
  const { user, loading } = useAuth();
  const { selectedEntity } = useSelectedEntity();

  if (loading) return null;

  // Si no hay usuario -> login
  if (!user) return <Navigate to="/login" replace />;

  // Si no hay empresa seleccionada -> empresas
  if (!selectedEntity?.id) return <Navigate to="/empresas" replace />;

  return <>{children}</>;
}
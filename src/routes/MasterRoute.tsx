// src/routes/MasterRoute.tsx
import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";

export function MasterRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user || user.role !== "master") {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
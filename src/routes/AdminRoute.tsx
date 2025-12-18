// src/routes/AdminRoute.tsx
import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (user.role !== "admin" && user.role !== "master") {
    return <Navigate to="/empresas" replace />;
  }

  return <>{children}</>;
}
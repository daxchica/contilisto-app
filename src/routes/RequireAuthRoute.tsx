// src/routes/RequireAuthRoute.tsx

import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface Props {
  children?: React.ReactNode;
}

export default function RequireAuthRoute({ children }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-6">Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Support both wrapper mode and outlet mode
  return children ? <>{children}</> : <Outlet />;
}
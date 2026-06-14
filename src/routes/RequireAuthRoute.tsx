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

  const privilegedRoles = ["owner", "master", "admin", "accountant", "assistant"];
  if (!user.emailVerified && !privilegedRoles.includes(user.role)) {
    return <Navigate to="/verify-email" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

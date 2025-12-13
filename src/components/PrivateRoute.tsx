// src/components/PrivateRoute.tsx
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";

export default function PrivateRoute({ 
  children, 
  }: {
    children: React.ReactNode;
  }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        <p>Checking session...</p>
      </div>
    );
  }

  return user ? <>{children} </> : <Navigate to="/login" replace />;
}
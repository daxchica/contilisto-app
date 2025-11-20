// src/routes/index.tsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import MainLayout from "@/layouts/MainLayout";
import EntitiesDashboard from "../pages/EntitiesDashboard";
import FinancialsPage from "../pages/FinancialsPage";
import LedgerPage from "@/pages/LedgerPage";
import BankBookPage from "../pages/BankBookPage";
import Login from "../pages/Login";
import Register from "../pages/Register";
import NotFound from "../pages/NotFound";
import Landing from "../pages/Landing";

export default function AppRoutes() {
  return (
    <Routes>

      {/* Landing pública */}
      <Route path="/" element={<Landing />} />
      
      {/* Auth & registro */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Módulos Contilisto */}
      <Route 
        path="/empresas" 
        element={
          <MainLayout>
            <EntitiesDashboard />
          </MainLayout>
        } 
      />
      <Route 
        path="/estados-financieros" 
        element={
          <MainLayout>
            <FinancialsPage />
          </MainLayout>
        } 
      />
      <Route 
        path="/libro-mayor" 
        element={
          <MainLayout>
            <LedgerPage />
          </MainLayout>
        } 
      />
      <Route 
        path="/libro-bancos" 
        element=
          {
          <MainLayout>
            <BankBookPage />
          </MainLayout>
        } 
      />
      
      {/* Redirecciones limpias */}
      <Route path="/dashboard" element={<Navigate to="/empresas" replace />} />

      {/* Redirecciones y 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
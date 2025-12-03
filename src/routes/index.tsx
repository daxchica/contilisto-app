// src/routes/index.tsx
import React from "react";
import { Routes, Route } from "react-router-dom";

import AppLayout from "@/layouts/AppLayout";
import LedgerLayout from "@/layouts/LedgerLayout";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";

import DashboardHome from "@/pages/DashboardHome";
import ClientsPage from "@/pages/ClientsPage";
import InvoicePage from "@/pages/InvoicePage";
import AccountingDashboard from "@/pages/AccountingDashboard";
import FinancialStatements from "@/pages/FinancialStatements";
import LedgerPage from "@/pages/LedgerPage";
import BankBookPage from "@/pages/BankBookPage";
import CarteraCobro from "@/pages/CarteraCobro";
import Proveedores from "@/pages/Proveedores";
import Declaraciones from "@/pages/Declaraciones";
import FlujoCaja from "@/pages/FlujoCaja";
import NotFound from "@/pages/NotFound";

export default function AppRoutes() {
  return (
    <Routes>

      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Ledger-only Pages */}
      <Route
        path="/contabilidad"
        element={
          <AppLayout>
            <AccountingDashboard />
         </AppLayout>
        }
      />
      <Route
        path="/libro-mayor"
        element={
          <LedgerLayout>
            <LedgerPage />
          </LedgerLayout>
        }
      />

      {/* App Pages */}
      <Route
        path="/dashboard"
        element={
          <AppLayout>
            <DashboardHome />
          </AppLayout>
        }
      />

      <Route
        path="/clientes"
        element={
          <AppLayout>
            <ClientsPage />
          </AppLayout>
        }
      />

      <Route
        path="/facturacion"
        element={
          <AppLayout>
            <InvoicePage />
         </AppLayout>
        }
      />

      <Route
        path="/cartera"
        element={
          <AppLayout>
            <CarteraCobro />
          </AppLayout>
        }
      />

      <Route
        path="/proveedores"
        element={
          <AppLayout>
            <Proveedores />
          </AppLayout>
        }
      />

      <Route
        path="/estados-financieros"
        element={
          <LedgerLayout>
            <FinancialStatements />
          </LedgerLayout>
        }
      />

      <Route
        path="/libro-bancos"
        element={
          <LedgerLayout>
            <BankBookPage />
          </LedgerLayout>
        }
      />

      <Route
        path="/impuestos"
        element={
          <AppLayout>
            <Declaraciones />
          </AppLayout>
        }
      />

      <Route
        path="/flujo-caja"
        element={
          <AppLayout>
            <FlujoCaja />
          </AppLayout>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
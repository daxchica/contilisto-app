// src/routes/index.tsx

import { Routes, Route } from "react-router-dom";

import RequireAuthRoute from "@/routes/RequireAuthRoute";
import RequireEntityRoute from "./RequireEntityRoute";
import { AdminRoute } from "./AdminRoute";
import { MasterRoute } from "./MasterRoute";

import AppLayout from "@/layouts/AppLayout";
import AccountingLayout from "@/layouts/AccountingLayout";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/NotFound";

import DashboardHome from "@/pages/DashboardHome";
import InvoicePage from "@/pages/InvoicePage";
import FinancialStatements from "@/pages/FinancialStatements";
import LedgerPage from "@/pages/LedgerPage";
import BankBookPage from "@/pages/BankBookPage";
import Declaraciones from "@/pages/Declaraciones";
import FlujoCaja from "@/pages/CashFlowPage";
import CompaniesPage from "@/pages/CompaniesPage";
import ContactsPage from "@/pages/ContactsPage";
import SriSettingsPage from "@/pages/SriSettingsPage";
import AccountsReceivablePage from "@/pages/receivables/AccountReceivables";
import AccountsReceivableAgingPage from "@/pages/receivables/AccountsReceivableAgingPage";
import AccountingDashboard from "@/pages/AccountingDashboard";
import ProfilePage from "@/pages/ProfilePage";
import SettingsPage from "@/pages/SettingsPage";
import AccountsPayablePage from "@/pages/AccountsPayablePage";

// Admin
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import PlansConfig from "@/pages/admin/PlansCofig";
import AuditLogs from "@/pages/admin/AuditLogs";
import AccountsPayableAging from "@/pages/payables/AccountsPayableAging";

export default function AppRoutes() {
  return (
    <Routes>

      {/* ============================================================
       * PUBLIC
       * ============================================================ */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* ============================================================
       * AUTHENTICATED APP
       * ============================================================ */}
      <Route element={<RequireAuthRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/contactos" element={<ContactsPage />} />
          <Route path="/facturacion" element={<InvoicePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/configuracion" element={<SettingsPage />} />
          <Route path="/accountspayable" element={<AccountsPayablePage />} />
          <Route path="/accountsreceivable" element={<AccountsReceivablePage />} />
          <Route path="/accountsreceivables/aging" element={<AccountsReceivableAgingPage />} />
          <Route path="/impuestos" element={<Declaraciones />} />
          <Route path="/flujo-caja" element={<FlujoCaja />} />
          <Route path="/empresas" element={<CompaniesPage />} />
          <Route path="/configuracionSri" element={<SriSettingsPage />} />
          <Route path="/ap-aging" element={<AccountsPayableAging />} />
        </Route>
      </Route>

      {/* ============================================================
       * ACCOUNTING (ENTITY REQUIRED)
       * ============================================================ */}
      <Route
        element={
          <RequireAuthRoute>
            <RequireEntityRoute>
              <AccountingLayout />
            </RequireEntityRoute>
          </RequireAuthRoute>
        }
      >
        <Route path="/contabilidad" element={<AccountingDashboard />} />
        <Route path="/libros-auxiliares" element={<LedgerPage />} />
        <Route path="/estados-financieros" element={<FinancialStatements />} />
        <Route path="/libro-bancos" element={<BankBookPage />} />
      </Route>

      {/* ============================================================
       * ADMIN PANEL
       * ============================================================ */}
      <Route
        path="/admin"
        element={
          <RequireAuthRoute>
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          </RequireAuthRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsersPage />} />

        <Route
          path="plans"
          element={
            <MasterRoute>
              <PlansConfig />
            </MasterRoute>
          }
        />

        <Route
          path="audit"
          element={
            <MasterRoute>
              <AuditLogs />
            </MasterRoute>
          }
        />
      </Route>

      {/* ============================================================
       * FALLBACK
       * ============================================================ */}
      <Route path="*" element={<NotFound />} />

    </Routes>
  );
}
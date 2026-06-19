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
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import AuthActionPage from "@/pages/AuthActionPage";
import TrialPage from "@/pages/TrialPage";
import NotFound from "@/pages/NotFound";

import DashboardHome from "@/pages/DashboardHome";
import InvoicePage from "@/pages/InvoicePage";
import FinancialStatements from "@/pages/FinancialStatements";
import LedgerPage from "@/pages/LedgerPage";
import BankBookPage from "@/pages/BankBookPage";
import Declaraciones from "@/pages/Declaraciones";
import FlujoCaja from "@/pages/CashFlowPage";
import EquityChangesPage from "@/pages/EquityChangesPage";
import PersonalExpensesPage from "@/pages/PersonalExpensesPage";
import CompaniesPage from "@/pages/CompaniesPage";
import ContactsPage from "@/pages/ContactsPage";
import SriSettingsPage from "@/pages/SriSettingsPage";
import AccountsReceivablePage from "@/pages/receivables/AccountReceivablesPage";
import AccountsReceivableAgingPage from "@/pages/receivables/AccountsReceivableAgingPage";
import InvoiceHistoryPage from "@/pages/cartera/InvoiceHistoryPage";
import AccountingDashboard from "@/pages/AccountingDashboard";
import ProfilePage from "@/pages/ProfilePage";
import SettingsPage from "@/pages/SettingsPage";
import AccountsPayablePage from "@/pages/payables/AccountsPayablePage";

// Admin
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import PlansConfig from "@/pages/admin/PlansCofig";
import AuditLogs from "@/pages/admin/AuditLogs";
import AccountsPayableAging from "@/pages/payables/AccountsPayableAging";
import Success from "@/pages/Success";
import SaldoInicialPage from "@/pages/SaldoInicialPage";

export default function AppRoutes() {
  return (
    <Routes>

      {/* ============================================================
       * PUBLIC
       * ============================================================ */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/auth/action" element={<AuthActionPage />} />
      <Route path="/trial" element={<TrialPage />} />

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
          <Route path="/cartera/historial" element={<InvoiceHistoryPage />} />
          <Route path="/impuestos" element={<Declaraciones />} />
          <Route path="/flujo-caja" element={<FlujoCaja />} />
          <Route path="/empresas" element={<CompaniesPage />} />
          <Route path="/configuracionSri" element={<SriSettingsPage />} />
          <Route path="/ap-aging" element={<AccountsPayableAging />} />
          <Route path="/success" element={<Success />} />
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
        <Route path="/saldo-inicial" element={<SaldoInicialPage />} />
        <Route path="/patrimonio" element={<EquityChangesPage />} />
        <Route path="/gastos-personales" element={<PersonalExpensesPage />} />
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
// src/routes/index.tsx
import { Routes, Route } from "react-router-dom";

import RequireEntityRoute from "./RequireEntityRoute";
import { AdminRoute } from "./AdminRoute";
import { MasterRoute } from "./MasterRoute";

import AppLayout from "@/layouts/AppLayout";
import AccountingLayout from "@/layouts/AccountingLayout";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";

import DashboardHome from "@/pages/DashboardHome";

import InvoicePage from "@/pages/InvoicePage";
import AccountingDashboard from "@/pages/AccountingDashboard";
import FinancialStatements from "@/pages/FinancialStatements";
import LedgerPage from "@/pages/LedgerPage";
import BankBookPage from "@/pages/BankBookPage";
import CarteraCobro from "@/pages/AccountReceivables";

import Declaraciones from "@/pages/Declaraciones";
import FlujoCaja from "@/pages/CashFlowPage";
import NotFound from "@/pages/NotFound";
import CompaniesPage from "@/pages/CompaniesPage";

import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import PlansConfig from "@/pages/admin/PlansCofig";
import AuditLogs from "@/pages/admin/AuditLogs";

import AccountsReceivablePage from "@/pages/AccountReceivables";
import AccountsPayablePage from "@/pages/payables/AccountsPayable";
import ContactsPage from "@/pages/ContactsPage";
import SriSettingsPage from "@/pages/SriSettingsPage";

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
       * APP (GENERAL PAGES)
       * ============================================================ */}
      <Route path="/dashboard" element={<AppLayout><DashboardHome/></AppLayout>}/>
      <Route path="/contactos" element={<AppLayout><ContactsPage/></AppLayout>}/>
      <Route path="/facturacion" element={<AppLayout><InvoicePage/></AppLayout>}/>
      <Route path="/accountsreceivable" element={<AppLayout><AccountsReceivablePage/></AppLayout>}/>
      <Route path="/accountspayable" element={<AppLayout><AccountsPayablePage/></AppLayout>}/>
      <Route path="/impuestos" element={<AppLayout><Declaraciones /></AppLayout>}/>
      <Route path="/flujo-caja" element={<AppLayout><FlujoCaja/></AppLayout>}/>
      <Route path="/empresas" element={ <AppLayout><CompaniesPage/></AppLayout>}/>
      <Route path="/configuracionSri" element={ <AppLayout><SriSettingsPage/></AppLayout>}/>
      <Route path="/app" element={<AppLayout><CompaniesPage/></AppLayout>}/>
      {/* =========================
         ACCOUNTING (NAVBAR ONLY HERE) - AccountingLayout
         IMPORTANT: do NOT wrap with AppLayout
      ========================== */}
      <Route 
        element={
          <RequireEntityRoute>
            <AccountingLayout />
          </RequireEntityRoute>
        }
      >
        <Route path="/contabilidad" element={<AccountingDashboard />} />
        <Route path="/libros-auxiliares" element={ <LedgerPage /> }/>
        <Route path="/estados-financieros" element={<FinancialStatements />}/>
        <Route path="/libro-bancos" element={ <BankBookPage /> }/>
      </Route>

      {/* ============================================================
       * ADMIN PANEL (ADMIN + MASTER)
       * ============================================================ */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsersPage />} />

        {/* SOLO MASTER */}
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
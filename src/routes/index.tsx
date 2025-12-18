// src/routes/index.tsx

import RequireEntityRoute from "./RequireEntityRoute";
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
import CompaniesPage from "@/pages/CompaniesPage";

import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import PlansConfig from "@/pages/admin/PlansCofig";
import AuditLogs from "@/pages/admin/AuditLogs";

import { AdminRoute } from "./AdminRoute";
import { MasterRoute } from "./MasterRoute";
import AccountsPayablePage from "@/pages/payables/AccountsPayable";

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
       * APP (USERS)
       * ============================================================ */}
      <Route path="/app" element={<AppLayout><CompaniesPage/></AppLayout>}/>
      <Route path="/dashboard" element={<AppLayout><DashboardHome/></AppLayout>}/>
      <Route path="/clientes" element={<AppLayout><ClientsPage/></AppLayout>}/>
      <Route path="/facturacion" element={<AppLayout><InvoicePage/></AppLayout>}/>
      <Route path="/cartera" element={<AppLayout><CarteraCobro/></AppLayout>}/>
      <Route path="/accountspayable" element={<AppLayout><AccountsPayablePage/></AppLayout>}/>
      <Route path="/proveedores"  element={ <AppLayout> <Proveedores/></AppLayout>}/>
      <Route path="/impuestos" element={<AppLayout><Declaraciones /></AppLayout>}/>
      <Route path="/flujo-caja" element={<AppLayout><FlujoCaja/></AppLayout>}/>
      <Route path="/empresas" element={ <AppLayout><CompaniesPage/></AppLayout>}/>

      {/* ============================================================
       * CONTABILIDAD / LEDGER
       * ============================================================ */}
      <Route
        path="/contabilidad"
        element={
          <RequireEntityRoute>
            <AppLayout>
              <AccountingDashboard />
          </AppLayout>
         </RequireEntityRoute>
        }
      />
      <Route
        path="/libro-mayor"
        element={
          <RequireEntityRoute>
            <LedgerLayout>
              <LedgerPage />
            </LedgerLayout>
          </RequireEntityRoute>
        }
      />

      <Route
        path="/estados-financieros"
        element={
          <RequireEntityRoute>
            <LedgerLayout>
              <FinancialStatements />
            </LedgerLayout>
          </RequireEntityRoute>
        }
      />

      <Route
        path="/libro-bancos"
        element={
          <RequireEntityRoute>
            <LedgerLayout>
              <BankBookPage />
            </LedgerLayout>
          </RequireEntityRoute>
        }
      />

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
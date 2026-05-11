// src/pages/admin/AdminLayout.tsx
import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { useAuth } from "@/context/AuthContext";

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Cargando...</div>
      </div>
    );
  }

  const role = user?.role;
  const isOwner = role === "owner" || role === "master";

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white shadow rounded-xl p-6 max-w-md w-full">
          <h2 className="text-lg font-bold text-slate-800">Acceso restringido</h2>
          <p className="text-sm text-slate-600 mt-2">
            No tienes permisos para acceder al panel de administración.
          </p>
          <button
            onClick={() => navigate("/empresas", { replace: true })}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Ir a Empresas
          </button>
        </div>
      </div>
    );
  }

  const logout = async () => {
    await signOut(getAuth());
    navigate("/", { replace: true });
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
      isActive ? "bg-blue-100 text-blue-700" : "text-slate-700 hover:bg-slate-100"
    }`;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-blue-700">Contilisto Admin</h1>
          <p className="text-xs text-slate-500 mt-0.5">Acceso Owner</p>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={() => setDrawerOpen(false)}
          className="md:hidden text-slate-400 hover:text-slate-600 text-xl leading-none p-1"
          aria-label="Cerrar menú"
        >
          ✕
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        <NavLink to="/admin" end className={navLinkClass}>Dashboard</NavLink>
        <NavLink to="/admin/users" className={navLinkClass}>Usuarios</NavLink>

        {isOwner && (
          <>
            <NavLink to="/admin/plans" className={navLinkClass}>Configuración de Planes</NavLink>
            <NavLink to="/admin/audit" className={navLinkClass}>Auditoría</NavLink>
          </>
        )}

        <div className="pt-4 mt-4 border-t space-y-1">
          <button
            onClick={() => navigate("/empresas")}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
          >
            ← Volver a Contilisto
          </button>
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
          >
            🚪 Salir
          </button>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-6 py-3 border-t text-xs text-slate-500">
        <div className="font-medium text-slate-700 truncate">{user?.email}</div>
        <div>Rol: {role}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ── Mobile top bar ── */}
      <header className="md:hidden flex items-center gap-3 bg-white border-b px-4 py-3 sticky top-0 z-30">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menú"
          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
        >
          {/* Hamburger */}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="font-bold text-blue-700 text-sm">Contilisto Admin</span>
      </header>

      {/* ── Mobile drawer overlay ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r z-50 transition-transform duration-200 md:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* ── Desktop layout ── */}
      <div className="hidden md:flex min-h-screen">
        <aside className="w-64 bg-white border-r flex-shrink-0">
          <SidebarContent />
        </aside>
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile content (below top bar) ── */}
      <main className="md:hidden p-4">
        <Outlet />
      </main>

    </div>
  );
}

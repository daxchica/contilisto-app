// src/pages/admin/AdminLayout.tsx
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function AdminLayout() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* ============================================================
       * SIDEBAR
       * ============================================================ */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="px-6 py-4 border-b">
          <h1 className="text-lg font-bold text-blue-700">
            Contilisto Admin
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Acceso {user?.role === "master" ? "Master" : "Admin"}
          </p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 text-sm">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg font-medium ${
                isActive
                  ? "bg-blue-100 text-blue-700"
                  : "text-slate-700 hover:bg-slate-100"
              }`
            }
          >
            Dashboard
          </NavLink>

          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg font-medium ${
                isActive
                  ? "bg-blue-100 text-blue-700"
                  : "text-slate-700 hover:bg-slate-100"
              }`
            }
          >
            Usuarios
          </NavLink>

          {/* SOLO MASTER */}
          {user?.role === "master" && (
            <>
              <NavLink
                to="/admin/plans"
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-lg font-medium ${
                    isActive
                      ? "bg-blue-100 text-blue-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`
                }
              >
                Configuración de Planes
              </NavLink>

              <NavLink
                to="/admin/audit"
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-lg font-medium ${
                    isActive
                      ? "bg-blue-100 text-blue-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`
                }
              >
                Auditoría
              </NavLink>
            </>
          )}
        </nav>

        {/* FOOTER SIDEBAR */}
        <div className="px-6 py-4 border-t text-xs text-slate-500">
          <div className="font-medium text-slate-700">
            {user?.email}
          </div>
          <div>Rol: {user?.role}</div>
        </div>
      </aside>

      {/* ============================================================
       * CONTENT
       * ============================================================ */}
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
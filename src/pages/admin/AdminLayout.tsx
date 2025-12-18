// src/pages/admin/AdminLayout.tsx
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { useAuth } from "@/context/AuthContext";

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // 1) Loading safe
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Cargando...</div>
      </div>
    );
  }

  // 2) Hard guard (defensive)
  const role = user?.role;
  const isAdminOrMaster = role === "admin" || role === "master";

  if (!isAdminOrMaster) {
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
    const auth = getAuth();
    await signOut(auth);
    navigate("/", { replace: true });
  };


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
            Acceso {role === "master" ? "Master" : "Admin"}
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

          {/* Quick actions */}
          <div className="pt-4 mt-4 border-t">
            <button
              onClick={() => navigate("/empresas")}
              className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100"
            >
              ← Volver a Contilisto
            </button>

            <button
              onClick={logout}
              className="w-full text-left px-3 py-2 rounded-lg text-red-600 hover:bg-red-50"
            >
              🚪 Salir
            </button>
          </div>
        </nav>

        {/* FOOTER SIDEBAR */}
        <div className="px-6 py-4 border-t text-xs text-slate-500">
          <div className="font-medium text-slate-700">
            {user?.email}
          </div>
          <div>Rol: {role}</div>
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
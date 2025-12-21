import React, {
  useState,
  useRef,
  useEffect,
  useCallback
} from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase-config";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { useEntities } from "@/hooks/useEntities";
import { useAuth } from "@/context/AuthContext";
import type { Entity } from "@/types/Entity";

/* ================================
   Props
================================ */
interface SidebarProps {
  onClose?: () => void; // solo para mobile drawer
}

/* ================================
   Component
================================ */
export default function Sidebar({ onClose }: SidebarProps) {
  const { user } = useAuth();
  const isMaster = user?.role === "master";

  const { selectedEntity, setEntity } = useSelectedEntity();
  const { entities } = useEntities();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* ================================
     Helpers
  ================================ */
  const closeDrawer = useCallback(() => {
    onClose?.();
  }, [onClose]);

  /* ================================
     Close dropdown on outside click
  ================================ */
  useEffect(() => {
    function handlePointer(e: Event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);

    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
    };
  }, []);

  /* ================================
     Close dropdown on route change
  ================================ */
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  /* ================================
     ESC closes drawer (mobile)
  ================================ */
  useEffect(() => {
    if (!onClose) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeDrawer();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, closeDrawer]);

  /* ================================
     Navigation guards
  ================================ */
  const guardLink = (e: React.MouseEvent) => {
    if (isMaster) {
      e.preventDefault();
      closeDrawer();
      navigate("/admin");
      return;
    }

    if (!selectedEntity) {
      e.preventDefault();
      alert("Selecciona una empresa primero");
      return;
    }

    closeDrawer();
  };

  const handleSecureNavigation = (path: string) => {
    if (isMaster) {
      alert("La cuenta master está destinada al panel de administración.");
      closeDrawer();
      navigate("/admin");
      return;
    }

    if (!selectedEntity) {
      alert("Debes seleccionar una empresa primero.");
      return;
    }

    closeDrawer();
    navigate(path);
  };

  /* ================================
     Entity selector
  ================================ */
  const handleSelectEntity = (ent: Entity) => {
    setEntity({
      id: ent.id,
      ruc: ent.ruc,
      name: ent.name,
      type: ent.type,
      uid: ent.uid ?? "",
      createdAt: ent.createdAt ?? Date.now(),
    });

    setOpen(false);
    closeDrawer();
    navigate("/dashboard");
  };

  /* ================================
     Logout
  ================================ */
  const logout = async () => {
    try {
      await signOut(auth);
    } finally {
      setEntity(null);
      closeDrawer();
      navigate("/", { replace: true });
    }
  };

  const LinkRow = ({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: string;
}) => (
  <NavLink
    to={to}
    onClick={guardLink}
    className={({ isActive }) =>
      `sidebar-link flex items-center gap-3 ${
        isActive ? "bg-white/20 font-semibold" : ""
      }`
    }
  >
    <span className="w-6 flex justify-center items-center text-lg leading-none">
      {icon}
    </span>
    <span className="leading-tight">{label}</span>
  </NavLink>
);

  /* ================================
     Render
  ================================ */
  return (
    <aside className="w-64 h-full bg-[#0A3558] text-white flex flex-col py-6 px-4 overflow-y-auto">
      {/* Mobile close button */}
      {onClose && (
        <div className="md:hidden flex justify-end mb-2">
          <button
            onClick={closeDrawer}
            className="text-white text-xl"
            aria-label="Cerrar menú"
            type="button"
          >
            ✕
          </button>
        </div>
      )}

      {/* LOGO */}
      <div className="text-2xl font-bold mb-6 tracking-wide">
        CONTILISTO
      </div>

      {/* SELECTOR DE EMPRESA */}
      {!isMaster && (
        <div ref={dropdownRef} className="relative mb-8">
          <button
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            aria-controls="entity-dropdown"
            className="w-full flex flex-col text-left bg-white/10 px-3 py-2 rounded-lg hover:bg-white/20 transition"
            type="button"
          >
            <span className="font-semibold leading-tight">
              {selectedEntity?.name ?? "Selecciona una empresa"}
            </span>

            {selectedEntity?.ruc && (
              <span className="text-xs opacity-80 leading-tight">
                {selectedEntity.ruc}
              </span>
            )}

            <span className="self-end text-xs mt-1">
              {open ? "▲" : "▼"}
            </span>
          </button>

          {open && (
            <div
              id="entity-dropdown"
              className="absolute left-0 right-0 mt-2 bg-white text-gray-800 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto"
            >
              {!entities?.length && (
                <div className="px-4 py-3 text-gray-500 text-sm">
                  No hay empresas
                </div>
              )}

              {(entities ?? []).map((e: Entity) => (
                <button
                  key={e.id}
                  onClick={() => handleSelectEntity(e)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                    selectedEntity?.id === e.id
                      ? "bg-gray-200 font-semibold"
                      : ""
                  }`}
                  type="button"
                >
                  {e.name}
                  <div className="text-xs text-gray-600">{e.ruc}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MENU */}
      <nav className="flex flex-col space-y-4">
        <button
          onClick={() => handleSecureNavigation("/dashboard")}
          className="text-left sidebar-link"
          type="button"
        >
          📊 Dashboard
        </button>

        <NavLink
          to={isMaster ? "/admin" : selectedEntity ? "/clientes" : "#"}
          onClick={guardLink}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "bg-white/20 font-semibold" : ""}`
          }
        >
          👥 Clientes
        </NavLink>

        <NavLink
          to={isMaster ? "/admin" : selectedEntity ? "/proveedores" : "#"}
          onClick={guardLink}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "bg-white/20 font-semibold" : ""}`
          }
        >
          🧑‍🔧 Proveedores
        </NavLink>

        <NavLink
          to={isMaster ? "/admin" : selectedEntity ? "/facturacion" : "#"}
          onClick={guardLink}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "bg-white/20 font-semibold" : ""}`
          }
        >
          🧾 Facturación Electrónica (SRI)
        </NavLink>

        <NavLink
          to={isMaster ? "/admin" : selectedEntity ? "/cartera" : "#"}
          onClick={guardLink}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "bg-white/20 font-semibold" : ""}`
          }
        >
          💼 Documentos x Cobrar
        </NavLink>

        <NavLink
          to={isMaster ? "/admin" : selectedEntity ? "/accountspayable" : "#"}
          onClick={guardLink}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "bg-white/20 font-semibold" : ""}`
          }
        >
          💼 Documentos x Pagar
        </NavLink>

        {/* CONTABILIDAD */}
        <div className="text-xs uppercase tracking-wide text-gray-300 mt-4 mb-1">
          Contabilidad
        </div>

        <LinkRow
          to={isMaster ? "/admin" : selectedEntity ? "/contabilidad" : "#"}
          icon="📊"
          label="Libro de Diario"
        />

        <LinkRow
          to={isMaster ? "/admin" : selectedEntity ? "/libros-auxiliares" : "#"}
          icon="📘"
          label="Libros Auxiliares"
        />

        <LinkRow
          to={isMaster ? "/admin" : selectedEntity ? "/libro-bancos" : "#"}
          icon="🏦"
          label="Libro Bancos"
        />

        <LinkRow
          to={isMaster ? "/admin" : selectedEntity ? "/estados-financieros" : "#"}
          icon="📈"  
          label="Estados Financieros"
        />

        {/* IMPUESTOS */}
        <div className="text-xs uppercase tracking-wide text-gray-300 mt-4 mb-1">
          Impuestos
        </div>

        <NavLink
          to={isMaster ? "/admin" : selectedEntity ? "/impuestos" : "#"}
          onClick={guardLink}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "bg-white/20 font-semibold" : ""}`
          }
        >
          📝 Declaraciones SRI
        </NavLink>

        {/* CONFIG */}
        <div className="text-xs uppercase tracking-wide text-gray-300 mt-4 mb-1">
          Configuración
        </div>

        {isMaster ? (
          <NavLink
            to="/admin"
            onClick={closeDrawer}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? "bg-white/20 font-semibold" : ""}`
            }
          >
            Admin Panel
          </NavLink>
        ) : (
          <NavLink
            to="/empresas"
            onClick={guardLink}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? "bg-white/20 font-semibold" : ""}`
            }
          >
            🏢 Empresas
          </NavLink>
        )}
      </nav>

      {/* LOGOUT */}
      <div className="mt-auto border-t border-white/20 pt-4">
        <button
          onClick={logout}
          className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition text-red-300"
          type="button"
        >
          🚪 Salir
        </button>
      </div>
    </aside>
  );
}
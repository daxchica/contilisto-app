import React, { useState, useRef, useEffect, useCallback } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase-config";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { useEntities } from "@/hooks/useEntities";
import { useAuth } from "@/context/AuthContext";
import type { Entity } from "@/types/Entity";

interface SidebarProps {
  onClose?: () => void; // solo para mobile drawer
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { user } = useAuth();
  const isMaster = (user as any)?.role === "master";

  const { entities } = useEntities();
  const { selectedEntity, setEntity } = useSelectedEntity();
  
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>("cartera");

  const dropdownRef = useRef<HTMLDivElement>(null);

  const closeDrawer = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // Cierra dropdown al hacer click fuera
  useEffect(() => {
    function handlePointer(e: MouseEvent | TouchEvent) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) {
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

  // Cierra dropdown al cambiar de ruta
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // ESC cierra drawer (mobile)
  useEffect(() => {
    if (!onClose) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeDrawer();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, closeDrawer]);

  // Guard central (para todo lo que requiere empresa seleccionada)
  const requireEntityOrRedirect = useCallback((): boolean => {
    if (isMaster) {
      alert("La cuenta master está destinada al panel de administración.");
      closeDrawer();
      navigate("/admin", { replace: true });
      return false;
    }

    if (!selectedEntity) {
      closeDrawer();
      navigate("/empresas", { replace: true });
      return false;
    }

    return true;
  }, [isMaster, selectedEntity, closeDrawer, navigate]);

  const handleSecureNavigation = useCallback(
    (path: string) => {
      if (!requireEntityOrRedirect()) return;
      closeDrawer();
      navigate(path);
    },
    [requireEntityOrRedirect, closeDrawer, navigate]
  );

  const handleSelectEntity = (ent: Entity) => {
    setEntity(ent);   // ← PASS FULL ENTITY

    setOpen(false);
    closeDrawer();
    navigate("/dashboard", { replace: true });
  };

  const logout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      setEntity(null);
      localStorage.clear();
      sessionStorage.clear();

      await signOut(auth);

      navigate("/", { replace: true});
    } catch (err) {
      console.error("Error al cerrar sesion", err);
    } finally {
      setEntity(null);
      
      closeDrawer();
      setLoggingOut(false);
    }
  };

  const LinkRow = ({
    to,
    label,
    icon,
    requiresEntity = false,
  }: {
    to: string;
    label: string;
    icon: string;
    requiresEntity?: boolean;
  }) => {
    // Si requiere empresa, no usamos href "#": usamos navegación controlada
    if (requiresEntity) {
      const isActive = location.pathname.startsWith(to);
      return (
        <button
          type="button"
          onClick={() => handleSecureNavigation(to)}
          className={`sidebar-link flex items-center gap-3 text-left w-full ${
            isActive ? "bg-white/20 font-semibold" : ""
          }`}
        >
          <span className="w-6 text-lg leading-none">{icon}</span>
          <span>{label}</span>
        </button>
      );
    }

    return (
      <NavLink
        to={to}
        onClick={() => closeDrawer()}
        className={({ isActive }) =>
          `sidebar-link flex items-center gap-3 ${
            isActive ? "bg-white/20 font-semibold" : ""
          }`
        }
      >
        <span className="w-6 text-lg">{icon}</span>
        <span>{label}</span>
      </NavLink>
    );
  };

    const Section = ({
    id,
    title,
    icon,
    children,
  }: {
    id: string;
    title: string;
    icon: string;
    children: React.ReactNode;
  }) => {
    const isOpen = openSection === id;

    return (
      <div>
        <button
          onClick={() => setOpenSection(isOpen ? null : id)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition"
          type="button"
        >
          <div className="flex items-center gap-3">
            <span className="w-6">{icon}</span>
            <span className="font-medium">{title}</span>
          </div>
          <span className="text-xs">{isOpen ? "▲" : "▼"}</span>
        </button>

        {isOpen && (
          <div className="ml-8 mt-2 flex flex-col space-y-2">
            {children}
          </div>
        )}
      </div>
    );
  };

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
      <div className="text-2xl font-bold mb-6 tracking-wide">CONTILISTO</div>

      {/* SELECTOR DE EMPRESA */}
      {!isMaster && (
        <div ref={dropdownRef} className="relative mb-8">
          <button
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="listbox"
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

            <span className="self-end text-xs mt-1">{open ? "▲" : "▼"}</span>
          </button>

          {open && (
            <div
              id="entity-dropdown"
              role="listbox"
              aria-label="Seleccionar empresa"
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
                    role="option"
                    aria-selected={selectedEntity?.id === e.id}
                    onClick={() => handleSelectEntity(e)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                      selectedEntity?.id === e.id ? "bg-gray-200 font-semibold" : ""
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
      <nav className="flex flex-col space-y-2">

        {/* Dashboard */}
        <LinkRow to="/dashboard" icon="📊" label="Dashboard" requiresEntity />

        {/* Contactos */}
        <LinkRow to="/contactos" icon="👥" label="Contactos" requiresEntity />

        {/* =========================
            CARTERA (KEY MODULE)
        ========================= */}
        <Section id="cartera" title="Cartera" icon="💼">
          <LinkRow to="/accountsreceivable" icon="📥" label="Por Cobrar" requiresEntity />
          <LinkRow to="/accountspayable" icon="📤" label="Por Pagar" requiresEntity />
          <LinkRow to="/accountsreceivables/aging" icon="📊" label="Aging" requiresEntity />
        </Section>

        {/* =========================
            CONTABILIDAD
        ========================= */}
        <Section id="contabilidad" title="Contabilidad" icon="📘">
          <LinkRow to="/contabilidad" icon="⚙️" label="Procesamiento" requiresEntity />
          <LinkRow to="/libros-auxiliares" icon="📘" label="Libro Mayor" requiresEntity />
          <LinkRow to="/libro-bancos" icon="🏦" label="Libro Bancos" requiresEntity />
          <LinkRow to="/estados-financieros" icon="📈" label="Estados Financieros" requiresEntity />
        </Section>

        {/* =========================
            IMPUESTOS
        ========================= */}
        <Section id="impuestos" title="Impuestos" icon="🧾">
          <LinkRow to="/impuestos" icon="📝" label="Retenciones SRI" requiresEntity />
        </Section>

        {/* =========================
            CONFIGURACIÓN
        ========================= */}
        <Section id="config" title="Configuración" icon="⚙️">
          {isMaster ? (
            <LinkRow to="/admin" icon="🛠️" label="Admin Panel" />
          ) : (
            <LinkRow to="/empresas" icon="🏢" label="Empresas" />
          )}
          <LinkRow to="/configuracionSri" icon="📝" label="SRI" requiresEntity />
        </Section>

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
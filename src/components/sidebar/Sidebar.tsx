import React, { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { useEntities } from "@/hooks/useEntities";

export default function Sidebar() {
  const { selectedEntity, setEntity } = useSelectedEntity();
  const { entities } = useEntities();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelectEntity = (ent: any) => {
    setEntity({
      id: ent.id,
      ruc: ent.ruc,
      name: ent.name,
      type: ent.type,
      uid: ent.uid ?? "",
      createdAt: ent.createdAt ?? Date.now(),
    });

    setOpen(false);
    navigate("/dashboard");
  };

  const handleSecureNavigation = (path: string) => {
    if (!selectedEntity) {
      alert("Debes seleccionar una empresa primero.");
      return;
    }
    navigate(path);
  };

  const logout = async () => {
    const auth = getAuth();
    await signOut(auth);
    navigate("/", { replace: true });
  };

  return (
    <div 
      className="
        fixed
        top-0 left-0
        w-64 
        h-screen 
        bg-[#0A3558] 
        text-white 
        flex flex-col 
        py-6 px-4 
        overflow-y-auto
        z-[100]
      "
    >

      {/* LOGO */}
      <div className="text-2xl font-bold mb-6 tracking-wide">
        CONTILISTO
      </div>

      {/* SELECTOR DE EMPRESA */}
      <div ref={dropdownRef} className="relative mb-8">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex flex-col text-left bg-white/10 px-3 py-2 rounded-lg hover:bg-white/20 transition space-y-0"
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

        {/* Dropdown */}
        {open && (
          <div className="absolute left-0 right-0 mt-2 bg-white text-gray-800 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
            {entities?.length === 0 && (
              <div className="px-4 py-3 text-gray-500 text-sm">No hay empresas</div>
            )}

            {entities?.map((e: any) => (
              <button
                key={e.id}
                onClick={() => handleSelectEntity(e)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                  selectedEntity?.id === e.id
                    ? "bg-gray-200 font-semibold"
                    : ""
                }`}
              >
                {e.name}
                <div className="text-xs text-gray-600">{e.ruc}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* MENU */}
      <nav className="flex flex-col space-y-4">

        {/* DASHBOARD */}
        <button
          onClick={() => handleSecureNavigation("/dashboard")}
          className="text-left sidebar-link"
        >
          📊 Dashboard
        </button>

        {/* GROUP TITLE */}
        <div className="text-xs uppercase tracking-wide text-gray-300 mt-4 mb-1">
          Contables
        </div>

        <NavLink
          to={selectedEntity ? "/contabilidad" : "#"}
          onClick={(e) => {
            if (!selectedEntity) {
              e.preventDefault();
              alert("Selecciona una empresa primero.");
            }
          }}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "bg-white/20 font-semibold" : ""}`
          }
        >
          📘 Contabilidad
        </NavLink>

        <NavLink
          to={selectedEntity ? "/facturacion" : "#"}
          onClick={(e) => {
            if (!selectedEntity) {
              e.preventDefault();
              alert("Selecciona una empresa primero.");
            }
          }}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "bg-white/20 font-semibold" : ""}`
          }
        >
          🧾 Facturación Electrónica (SRI)
        </NavLink>

        <NavLink
          to={selectedEntity ? "/clientes" : "#"}
          onClick={(e) => {
            if (!selectedEntity) {
              e.preventDefault();
              alert("Selecciona una empresa primero.");
            }
          }}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "bg-white/20 font-semibold" : ""}`
          }
        >
          👥 Clientes
        </NavLink>

        <NavLink
          to={selectedEntity ? "/proveedores" : "#"}
          onClick={(e) => {
            if (!selectedEntity) {
              e.preventDefault();
              alert("Selecciona una empresa primero.");
            }
          }}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "bg-white/20 font-semibold" : ""}`
          }
        >
          🧑‍🔧 Proveedores
        </NavLink>

        <NavLink
          to={selectedEntity ? "/cartera" : "#"}
          onClick={(e) => {
            if (!selectedEntity) {
              e.preventDefault();
              alert("Selecciona una empresa primero.");
            }
          }}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "bg-white/20 font-semibold" : ""}`
          }
        >
          💼 Cartera de Cobro
        </NavLink>

        {/* IMPUESTOS */}
        <div className="text-xs uppercase tracking-wide text-gray-300 mt-4 mb-1">
          Impuestos
        </div>

        <NavLink
          to={selectedEntity ? "/impuestos" : "#"}
          onClick={(e) => {
            if (!selectedEntity) {
              e.preventDefault();
              alert("Selecciona una empresa primero.");
            }
          }}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "bg-white/20 font-semibold" : ""}`
          }
        >
          📝 Declaraciones SRI
        </NavLink>

        {/* FINANZAS */}
        <div className="text-xs uppercase tracking-wide text-gray-300 mt-4 mb-1">
          Finanzas
        </div>

        <NavLink
          to={selectedEntity ? "/flujo-caja" : "#"}
          onClick={(e) => {
            if (!selectedEntity) {
              e.preventDefault();
              alert("Selecciona una empresa primero.");
            }
          }}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "bg-white/20 font-semibold" : ""}`
          }
        >
          💰 Flujo de Caja
        </NavLink>

        <NavLink
          to={selectedEntity ? "/reportes" : "#"}
          onClick={(e) => {
            if (!selectedEntity) {
              e.preventDefault();
              alert("Selecciona una empresa primero.");
            }
          }}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "bg-white/20 font-semibold" : ""}`
          }
        >
          📈 Reportes Financieros
        </NavLink>

        <NavLink
          to={selectedEntity ? "/bancos" : "#"}
          onClick={(e) => {
            if (!selectedEntity) {
              e.preventDefault();
              alert("Selecciona una empresa primero.");
            }
          }}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "bg-white/20 font-semibold" : ""}`
          }
        >
          🏦 Cuentas Bancarias
        </NavLink>

        {/* CONFIGURACIÓN */}
        <div className="text-xs uppercase tracking-wide text-gray-300 mt-4 mb-1">
          Configuración
        </div>

        <NavLink
          to="/empresas"
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "bg-white/20 font-semibold" : ""}`
          }
        >
          🏢 Empresas
        </NavLink>
      </nav>

      {/* LOGOUT AT BOTTOM */}
      <div className="mt-auto border-t border-white/20 pt-4">
        <button
          onClick={logout}
          className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition text-red-300"
        >
          🚪 Salir
        </button>
      </div>
    </div>
  );
}
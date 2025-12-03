// src/components/sidebar/Sidebar.tsx
import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { useEntities } from "@/hooks/useEntities";

const Sidebar = () => {
  const { selectedEntity, setSelectedEntity } = useSelectedEntity();
  const { entities } = useEntities();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);

  const handleSelectEntity = (ent: any) => {
    setSelectedEntity({
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

  return (
    <div className="w-64 bg-[#0A3558] text-white flex flex-col py-6 px-4">

      {/* LOGO */}
      <div className="text-2xl font-bold mb-6 tracking-wide">
        CONTILISTO
      </div>

      {/* SELECTOR DE EMPRESA */}
      <div className="relative mb-8">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between bg-white/10 px-3 py-2 rounded-lg hover:bg-white/20 transition"
        >
          <span className="font-semibold">
            {selectedEntity ? selectedEntity.name : "Selecciona una empresa"}
          </span>
          <span>{open ? "▲" : "▼"}</span>
        </button>

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
                  selectedEntity?.id === e.id ? "bg-gray-200 font-semibold" : ""
                }`}
              >
                {e.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* MENÚ DEL SISTEMA */}
      <nav className="flex flex-col space-y-4">

        {/* --- DASHBOARD --- */}
        <NavLink to="/dashboard" className="sidebar-link">
          📊 Dashboard
        </NavLink>

        {/* --- CONTABILIDAD --- */}
        <div className="text-xs uppercase tracking-wide text-gray-300 mt-4 mb-1">
          Contables
        </div>

        <NavLink to="/contabilidad" className="sidebar-link">
          📘 Contabilidad
        </NavLink>

        <NavLink to="/facturacion" className="sidebar-link">
          🧾 Facturación Electrónica (SRI)
        </NavLink>

        <NavLink to="/clientes" className="sidebar-link">
          👥 Clientes
        </NavLink>

        <NavLink to="/proveedores" className="sidebar-link">
          🧑‍🔧 Proveedores
        </NavLink>

        <NavLink to="/cartera" className="sidebar-link">
          💼 Cartera de Cobro
        </NavLink>

        {/* --- IMPUESTOS --- */}
        <div className="text-xs uppercase tracking-wide text-gray-300 mt-4 mb-1">
          Impuestos
        </div>

        <NavLink to="/impuestos" className="sidebar-link">
          📝 Declaraciones SRI
        </NavLink>

        {/* --- FINANZAS --- */}
        <div className="text-xs uppercase tracking-wide text-gray-300 mt-4 mb-1">
          Finanzas
        </div>

        <NavLink to="/flujo-caja" className="sidebar-link">
          💰 Flujo de Caja
        </NavLink>

        <NavLink to="/reportes" className="sidebar-link">
          📈 Reportes Financieros
        </NavLink>

        <NavLink to="/bancos" className="sidebar-link">
          🏦 Cuentas Bancarias
        </NavLink>

        {/* --- CONFIG --- */}
        <div className="text-xs uppercase tracking-wide text-gray-300 mt-4 mb-1">
          Configuración
        </div>

        <NavLink to="/empresas" className="sidebar-link">
          🏢 Empresas
        </NavLink>
      </nav>
    </div>
  );
};

export default Sidebar;
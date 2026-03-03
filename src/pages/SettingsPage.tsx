// src/pages/SettingsPage.tsx

import { useState } from "react";

export default function SettingsPage() {
  const [theme, setTheme] = useState("light");
  const [defaultPage, setDefaultPage] = useState("/dashboard");

  const handleSave = () => {
    localStorage.setItem("app_theme", theme);
    localStorage.setItem("default_page", defaultPage);
    alert("Configuración guardada.");
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-8">
      <h1 className="text-2xl font-semibold mb-6">
        Configuración
      </h1>

      <div className="space-y-6">

        {/* Theme */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Tema
          </label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </select>
        </div>

        {/* Default Page */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Página Inicial
          </label>
          <select
            value={defaultPage}
            onChange={(e) => setDefaultPage(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="/dashboard">Dashboard</option>
            <option value="/financials">Estados Financieros</option>
            <option value="/cashflow">Flujo de Caja</option>
          </select>
        </div>

        {/* Danger Zone */}
        <div className="pt-6 border-t">
          <h2 className="text-red-600 font-semibold mb-2">
            Zona de riesgo
          </h2>

          <button className="bg-red-600 text-white px-4 py-2 rounded-lg">
            Eliminar cuenta
          </button>
        </div>

        <div className="pt-4">
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            Guardar Configuración
          </button>
        </div>

      </div>
    </div>
  );
}
import React from "react";
import DashboardLayout from "@/layouts/DashboardLayout";

export default function FlujoCaja() {
  return (
    <>
      <div className="bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-4 text-[#0A3558]">Flujo de Caja</h1>

        <p className="text-gray-700">
          Control total de ingresos, egresos, saldos bancarios, proyecciones, 
          y flujo de caja proyectado basado en IA según el comportamiento histórico.
        </p>

        <h2 className="mt-6 font-semibold text-lg">Valor para inversionistas</h2>
        <p className="text-gray-700">
          El flujo de caja es crítico para PYMEs.  
          Este módulo habilita un modelo de precios por valor (value-based pricing) 
          y permite vender planes avanzados.
        </p>
      </div>
    </>
  );
}
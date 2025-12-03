import React from "react";
import DashboardLayout from "@/layouts/DashboardLayout";

export default function CarteraCobro() {
  return (
    <>
      <div className="bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-4 text-[#0A3558]">Cartera de Cobro</h1>

        <p className="text-gray-700">
          Gestión completa de cuentas por cobrar, vencimientos, recordatorios automáticos,
          historial de pagos y reportes de cobranza.
        </p>

        <h2 className="mt-6 font-semibold text-lg">Valor para inversionistas</h2>
        <p className="text-gray-700">
          La cartera de cobro es uno de los módulos más buscados por PYMEs. 
          Permite aumentar la retención, vender add-ons premium y crear funcionalidades basadas en IA.
        </p>
      </div>
    </>
  );
}
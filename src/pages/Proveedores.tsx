import React from "react";
import DashboardLayout from "@/layouts/DashboardLayout";

export default function Proveedores() {
  return (
    <>
      <div className="bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-4 text-[#0A3558]">Proveedores</h1>

        <p className="text-gray-700">
          Módulo para administrar proveedores, ingresar facturas de compra, registrar retenciones, 
          generar órdenes de pago y controlar cuentas por pagar.
        </p>

        <h2 className="mt-6 font-semibold text-lg">Valor para inversionistas</h2>
        <p className="text-gray-700">
          Este módulo complementa el flujo completo de compras y pagos, 
          lo cual incrementa la captura de valor por usuario y habilita 
          integraciones con bancos y pago automático.
        </p>
      </div>
    </>
  );
}
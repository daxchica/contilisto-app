import React from "react";
import DashboardLayout from "@/layouts/DashboardLayout";

export default function Declaraciones() {
  return (
    <>
      <div className="bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-4 text-[#0A3558]">
          Declaraciones de Impuestos - SRI
        </h1>

        <p className="text-gray-700">
          Generación automática de formularios 104, 103, 102A, RDEP y anexos tributarios, 
          usando información contable en tiempo real.
        </p>

        <h2 className="mt-6 font-semibold text-lg">Valor para inversionistas</h2>
        <p className="text-gray-700">
          Es el módulo con mayor valor agregado. Permite que Contilisto compita con softwares 
          de declaraciones tributarias y reduce drásticamente el tiempo del contador.
        </p>
      </div>
    </>
  );
}
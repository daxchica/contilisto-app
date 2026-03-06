// src/pages/Declaraciones.tsx

import React, { useState } from "react";

export default function Declaraciones() {

  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  });

  return (
      <div className="space-y-6">

        {/* HEADER */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h1 className="text-2xl font-bold text-[#0A3558]">
            Declaraciones SRI
          </h1>

          <p className="text-gray-600 mt-2">
            Generación automática de formularios tributarios del 
            Servicio de Rentas Internas usando la información contable registrada.
          </p>

          {/* Period selector */}
          <div className="mt-4">
            <label className="text-sm font-semibold text-gray-700 mr-2">
              Periodo:
            </label>

            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="border rounded px-3 py-1"
            />
          </div>
        </div>


        {/* DECLARATION MODULES */}

        <div className="grid md:grid-cols-3 gap-4">

          {/* IVA 104 */}
          <div className="bg-white p-5 rounded-xl shadow border">
            <h3 className="font-bold text-lg text-[#0A3558]">
              IVA - Formulario 104
            </h3>

            <p className="text-sm text-gray-600 mt-2">
              Declaración mensual del Impuesto al Valor Agregado.
            </p>

            <div className="mt-4 text-sm">
              Estado: <span className="font-semibold text-yellow-600">Pendiente</span>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="px-3 py-1 bg-blue-600 text-white rounded">
                Generar
              </button>

              <button className="px-3 py-1 border rounded">
                Ver
              </button>
            </div>
          </div>


          {/* RETENCIONES 103 */}

          <div className="bg-white p-5 rounded-xl shadow border">
            <h3 className="font-bold text-lg text-[#0A3558]">
              Retenciones - Formulario 103
            </h3>

            <p className="text-sm text-gray-600 mt-2">
              Declaración mensual de retenciones en la fuente.
            </p>

            <div className="mt-4 text-sm">
              Estado: <span className="font-semibold text-yellow-600">Pendiente</span>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="px-3 py-1 bg-blue-600 text-white rounded">
                Generar
              </button>

              <button className="px-3 py-1 border rounded">
                Ver
              </button>
            </div>
          </div>


          {/* ATS */}

          <div className="bg-white p-5 rounded-xl shadow border">
            <h3 className="font-bold text-lg text-[#0A3558]">
              ATS
            </h3>

            <p className="text-sm text-gray-600 mt-2">
              Anexo Transaccional Simplificado (XML).
            </p>

            <div className="mt-4 text-sm">
              Estado: <span className="font-semibold text-yellow-600">Pendiente</span>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="px-3 py-1 bg-blue-600 text-white rounded">
                Generar XML
              </button>

              <button className="px-3 py-1 border rounded">
                Descargar
              </button>
            </div>
          </div>

        </div>


        {/* VALUE MESSAGE */}

        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="font-semibold text-lg text-[#0A3558]">
            Valor para Contadores
          </h2>

          <p className="text-gray-700 mt-2">
            Este módulo permite generar automáticamente las declaraciones tributarias
            requeridas por el SRI utilizando la información contable registrada en el sistema,
            reduciendo significativamente el tiempo de preparación de impuestos.
          </p>
        </div>
      </div>
  );
}
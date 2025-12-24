import React, { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import InvoiceClientSelector from "@/components/invoices/InvoiceClientSelector";
import { Contact } from "@/types/Contact";

export default function Facturacion() {
  const [selectedClient, setSelectedClient] = useState<Contact | null>(null);

  return (
    <DashboardLayout>
      <div className="bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-6 text-[#0A3558]">
          Facturación Electrónica SRI
        </h1>

        {/* === SELECTOR DE CLIENTE === */}
        <div className="mb-8">
          <InvoiceClientSelector 
            clients={[]}
            loading={false}
            value={selectedClient} 
            onChange={setSelectedClient} 
          />
        </div>

        {/* === INFO DEL CLIENTE SELECCIONADO === */}
        {selectedClient && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <h3 className="text-blue-900 font-semibold text-lg mb-1">
              Datos del Cliente
            </h3>
            <p className="text-sm text-blue-800">
              <strong>Nombre:</strong> {selectedClient.name}
            </p>
            <p className="text-sm text-blue-800">
              <strong>ID:</strong> {selectedClient.identification} ({selectedClient.identificationType})
            </p>
            {selectedClient.email && (
              <p className="text-sm text-blue-800">
                <strong>Email:</strong> {selectedClient.email}
              </p>
            )}
          </div>
        )}

        {/* === CONTENIDO ANTERIOR === */}
        <p className="text-gray-700 leading-relaxed">
          Módulo para la emisión de <strong>Facturas Electrónicas</strong>, 
          <strong>Notas de Crédito</strong> y <strong>Comprobantes de Retención</strong>, 
          cumpliendo con todas las normas del SRI Ecuador.
        </p>

        <h2 className="mt-6 font-semibold text-lg">Valor para inversionistas</h2>
        <p className="text-gray-700 leading-relaxed">
          Este módulo posiciona a Contilisto como competidor directo de los facturadores 
          electrónicos del Ecuador, abriendo un modelo de ingresos recurrentes con 
          altísima retención (churn bajo) y bajo costo de adquisición.
        </p>
      </div>
    </DashboardLayout>
  );
}
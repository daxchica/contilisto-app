import React from "react";
import Sidebar from "@/components/sidebar/Sidebar";


interface Props {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<Props> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      <div className="flex-1 p-6">
        <header className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-800">
            Dashboard Contilisto
          </h1>
          <div className="flex items-center space-x-4">
            <button
                aria-label="Buscar"
                title="Buscar" 
                className="text-gray-600 hover:text-gray-800"
                >
                    🔍
                </button>
            <button 
                aria-label="Perfil del usuario"
                title="Perfil del usuario"
                className="w-10 h-10 rounded-full bg-gray-300"
                >
                    <span className="sr-only">Perfil del usuario</span>
                </button>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
};

export default DashboardLayout;
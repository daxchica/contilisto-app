import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const displayName =
    user?.displayName || user?.email?.split("@")[0] || "Usuario";

  return (
    <div className="h-14 bg-blue-600 flex items-center justify-end px-6 relative">
      
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-white font-medium"
        >
          <div className="w-8 h-8 bg-white text-blue-600 rounded-full flex items-center justify-center font-bold">
            {displayName.charAt(0).toUpperCase()}
          </div>
          {displayName}
          <span>▼</span>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded shadow-lg text-gray-700">
            <button
              onClick={() => navigate("/profile")}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
            >
              Mi Perfil
            </button>

            <button
              onClick={() => navigate("/empresas")}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
            >
              Cambiar Empresa
            </button>

            <button
              onClick={() => navigate("/configuracion")}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
            >
              Configuración
            </button>

            <button
              onClick={async () => {
                await logout ();
              }}
              className="block w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
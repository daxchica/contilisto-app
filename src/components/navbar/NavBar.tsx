// src/components/navbar/NavBar.tsx
import { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { useSelectedEntity } from "@/context/SelectedEntityContext";

interface NavBarProps {
  onMenuClick?: () => void; // SOLO si el layout tiene sidebar
}

export default function NavBar({ onMenuClick }: NavBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedEntity } = useSelectedEntity();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(getAuth());
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const isHome = location.pathname === "/";

  return (
    <nav className="fixed top-0 right-0 left-0 md:left-64 z-40 bg-blue-700 text-white shadow-md">
      <div className="h-16 px-4 flex items-center justify-between">

        {/* ☰ Mobile menu button (ONLY if sidebar exists) */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden text-white text-xl px-2"
            aria-label="Abrir menú"
            type="button"
          >
            ☰
          </button>
        )}

        {/* Desktop navigation (Accounting only) */}
        {isLoggedIn && !isHome && (
          <div className="hidden md:flex gap-6 text-sm font-semibold mx-auto">
            <NavLink to="/contabilidad">
              {({ isActive }) => (
                <span className={isActive ? "text-yellow-300" : "hover:text-yellow-200"}>
                  Tablero
                </span>
              )}
            </NavLink>

            <NavLink to="/libro-mayor">
              {({ isActive }) => (
                <span className={isActive ? "text-yellow-300" : "hover:text-yellow-200"}>
                  Libro Mayor
                </span>
              )}
            </NavLink>

            <NavLink to="/libro-bancos">
              {({ isActive }) => (
                <span className={isActive ? "text-yellow-300" : "hover:text-yellow-200"}>
                  Libro Bancos
                </span>
              )}
            </NavLink>

            <NavLink to="/estados-financieros">
              {({ isActive }) => (
                <span className={isActive ? "text-yellow-300" : "hover:text-yellow-200"}>
                  Estados Financieros
                </span>
              )}
            </NavLink>
          </div>
        )}

        {/* Right section */}
        
       {/* {!checkingAuth && (
          <div className="flex items-center gap-4 text-sm">
            {selectedEntity?.name && (
              <span className="hidden sm:inline text-white/80 font-semibold">
                {selectedEntity.name}
              </span>
            )} 
          
            <button
              onClick={handleLogout}
              className="text-white/80 hover:text-white"
            >
              Salir
            </button>
          </div> 
        )}*/}
      </div>
    </nav>
  );
}
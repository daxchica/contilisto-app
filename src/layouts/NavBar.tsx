// components/NavBar.tsx
import { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { useSelectedEntity } from "@/context/SelectedEntityContext";

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const { entity } = useSelectedEntity(); // 👈 Preserve selected company

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
      const auth = getAuth();
      await signOut(auth);
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const isHome = location.pathname === "/";

  return (
    <nav className="fixed top-0 left-0 w-full bg-blue-700 text-white shadow-md z-50">
      <div className="px-6 py-3 flex items-center justify-between max-w-7xl mx-auto">
        
        {/* Logo */}
        <div className="text-xl font-bold tracking-tight">
          <NavLink to="/" className="hover:text-yellow-300 transition-all">
            Contilisto
          </NavLink>
        </div>

        {/* Navigation Menu */}
        {isLoggedIn && !isHome && (
          <div className="flex space-x-6 text-sm">

            <NavLink
              to="/contabilidad"
              className={({ isActive }) =>
                isActive ? "text-yellow-300 font-bold" : "hover:text-yellow-200"
              }
            >
              Tablero
            </NavLink>

            <NavLink
              to="/libro-mayor"
              className={({ isActive }) =>
                isActive ? "text-yellow-300 font-bold" : "hover:text-yellow-200"
              }
            >
              Libro Mayor
            </NavLink>

            <NavLink
              to={entity?.id ? "/libro-bancos" : "/contabilidad"}
              className={({ isActive }) =>
                isActive ? "text-yellow-300 font-bold" : "hover:text-yellow-200"
              }
            >
              Libro Bancos
            </NavLink>

            <NavLink
              to="/estados-financieros"
              className={({ isActive }) =>
                isActive ? "text-yellow-300 font-bold" : "hover:text-yellow-200"
              }
            >
              Estados Financieros
            </NavLink>

          </div>
        )}

        {/* Action section */}
        {!checkingAuth && (
          <div className="flex items-center space-x-4 text-sm">

            {/* Show selected entity name */}
            {entity?.name && (
              <span className="text-sm text-white/80 font-semibold">
                {entity.name}
              </span>
            )}

          </div>
        )}
      </div>
    </nav>
  );
}
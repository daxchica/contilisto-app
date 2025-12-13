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

  const { selectedEntity } = useSelectedEntity(); // 👈 Preserve selected company

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
    <nav 
      className="
        fixed 
        top-0 left-64 right-0 
        bg-blue-700 
        text-white 
        shadow-md 
        z-40
      "
    >
      <div 
        className="
          px-6 py-3 
          flex 
          items-center 
          justify-center
          relative
        "
      >
        
        {/* Logo */}
    {/*}    <div className="text-xl font-bold tracking-tight">
          <NavLink to="/" className="hover:text-yellow-300 transition-all">
            Contilisto
          </NavLink>
        </div> */}

        {/* Navigation Menu */}
        {isLoggedIn && !isHome && (
          <div className="flex gap-6 text-sm font-semibold mx-auto">

            <NavLink
              to="/contabilidad"
              className="relative group"
            >
              {({ isActive }) => (
                <div className="px-1 pb-1">
                  <span className={isActive ? "text-yellow-300" : "hover:text-yellow-200"}>
                    Tablero
                  </span>

                  <span
                    className={`absolute left-1/2 bottom-0 h-[2px] w-3/4 -translate-x-1/2 rounded bg-yellow-300 transition-transform duration-300 ease-out ${
                      isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </div>
              )}
            </NavLink>

            {/** LIBRO MAYOR */}
            <NavLink
              to="/libro-mayor"
              className="relative group"
            >
              {({ isActive }) => (
                <div className="px-1 pb-1">
                  <span className={isActive ? "text-yellow-300" : "hover:text-yellow-200"}>
                    Libro Mayor
                  </span>

                  <span
                    className={`absolute left-1/2 bottom-0 h-[2px] w-3/4 -translate-x-1/2 rounded bg-yellow-300 transition-transform duration-300 ease-out ${
                      isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </div>
              )}
            </NavLink>

            {/** LIBRO BANCOS */}
            <NavLink
              to="/libro-bancos"
              className="relative group"
            >
              {({ isActive }) => (
                <div className="px-1 pb-1">
                  <span className={isActive ? "text-yellow-300" : "hover:text-yellow-200"}>
                    Libro Bancos
                  </span>

                  <span
                    className={`absolute left-1/2 bottom-0 h-[2px] w-3/4 -translate-x-1/2 rounded bg-yellow-300 transition-transform duration-300 ease-out ${
                      isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </div>
              )}
            </NavLink>

            {/** ESTADOS FINANCIEROS */}
            <NavLink
              to="/estados-financieros"
              className="relative group"
            >
              {({ isActive }) => (
                <div className="px-1 pb-1">
                  <span className={isActive ? "text-yellow-300" : "hover:text-yellow-200"}>
                    Estados Financieros
                  </span>

                  <span
                    className={`absolute left-1/2 bottom-0 h-[2px] w-3/4 -translate-x-1/2 rounded bg-yellow-300 transition-transform duration-300 ease-out ${
                      isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </div>
              )}
            </NavLink>

          </div>
        )}

        {/* Action section */}
        {!checkingAuth && (
          <div className="flex items-center space-x-4 text-sm">

            {/* Show selected entity name */}
            {selectedEntity?.name && (
              <span className="text-sm text-white/80 font-semibold">
                {selectedEntity.name}
              </span>
            )}

          </div>
        )}
      </div>
    </nav>
  );
}
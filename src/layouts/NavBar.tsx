// components/NavBar.tsx
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";

export default function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  // Verifica autenticación
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Logout
  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      localStorage.removeItem("authToken");
      setTimeout(() => navigate("/", { replace: true }), 50);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Estilos para link activo
  const active = (path: string) =>
    location.pathname === path ? "text-yellow-300 font-semibold" : "hover:text-blue-300";

  const isLandingPage = location.pathname === "/";

  return (
    <nav className="fixed top-0 left-0 w-full bg-blue-700 text-white px-6 py-3 flex shadow-md z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between w-full">
        
        {/* Logo */}
        <div className="text-xl font-bold">
          <Link to="/" className="hover:underline">Contilisto</Link>
        </div>

        {/* Navigation Links */}
        {isLoggedIn && !isLandingPage && (
          <div className="flex space-x-6 text-sm">
            <Link to="/contabilidad" className="hover:text-blue-300">
              Tablero</Link>
            <Link to="/libro-mayor" className="hover:text-blue-300">
              Libro Mayor</Link>
            <Link to="/libro-bancos" className="hover:text-blue-300">
              Libro Bancos</Link>
            <Link to="/estados-financieros" className="hover:text-blue-300">
              Estados Financieros</Link>
          </div>
        )}

        {/* Login / Logout */}
        {!loading && (
          <div className="flex items-center text-sm space-x-4">
            {isLoggedIn ? (
              <button onClick={handleLogout} className="hover:underline">
                Logout
              </button>
            ) : (
              <>
                <Link to="/login" className="hover:underline">Login</Link>
                <Link to="/register" className="hover:underline">Registrarse</Link>
              </>
            )}
          </div>
        )}

      </div>
    </nav>
  );
}
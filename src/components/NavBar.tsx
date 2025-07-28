// components/NavBar.tsx
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged,signOut } from "firebase/auth";

export default function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLanding = location.pathname === "/";
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  // Verifica si hay un usuario autenticado
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Cerrar sesion
  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      localStorage.removeItem("authToken");
      // Redirige fuera del ciclo React actual
      setTimeout(() => {
        navigate("/", {replace: true}); // Redirige a la página principal
      }, 50); // pequeno delay evita conflico con <PrivateRoute>
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <nav className="bg-blue-700 text-white px-6 py-3 flex shadow-md">
      <div className="max-w-7x1 mx-auto flex items-center justify-between w-full">
        {/* Logo */}
        <div className="text-xl font-bold">
          <Link to="/" className="hover:underline">
            Contilisto
          </Link>
        </div>

        {/* Enlaces visibles solo si está logueado y no está en la landing */}
        {isLoggedIn && !isLanding && (
          <div className="flex space-x-6 text-sm">
            <Link to="/dashboard" className="text-white hover:text-blue-300">
              Tablero
            </Link>
            <Link to="/estados-financieros" className="text-white hover:text-blue-300">
              Estados Financieros
            </Link>
          </div>
        )}

        {/* Autenticacion */}
        {!loading && (
          <div className="flex items-center text-sm space-x-4">
            {!isLanding && (
              <Link to="/dashboard" className="hover:underline">
                Home
              </Link>
            )}

          {!isLoggedIn ? (
            <>
              <Link to="/login" className="hover:underline">
                Login
              </Link>
              <Link to="/register" className="hover:underline">
                Registrarse
              </Link>
            </>
          ) : (
            <button 
              onClick={handleLogout} 
              className="hover:underline"
              >
                Logout
              </button>
            )}
        </div>
      )}
      </div>
    </nav>
  );
}
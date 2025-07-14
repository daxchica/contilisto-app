// components/NavBar.tsx
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged,signOut } from "firebase/auth";

export default function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLanding = location.pathname === "/";
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Verifica si hay un usuario autenticado
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user); // true si está logueado
    });

    return () => unsubscribe(); // Limpieza
  }, []);

  // Cierre de sesion
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
    <nav className="bg-blue-700 text-white px-6 py-3 flex items-center justify-between shadow-md">
      <div className="text-lg font-bold">
        <Link to="/" className="hover:underline">
          Contilisto
        </Link>
      </div>

      <div className="space-x-4 text-sm">
        {!isLanding && (
          <Link to="/dashboard" className="hover:underline">
            Home
          </Link>
        )}

        {!isLoggedIn && (
          <>
            <Link to="/login" className="hover:underline">
              Login
            </Link>

            <Link to="/register" className="hover:underline">
              Registrarse
            </Link>
          </>
        )}

        {isLoggedIn && (
          <button onClick={handleLogout} className="hover:underline">
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}
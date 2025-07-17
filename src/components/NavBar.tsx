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
    <nav className="bg-blue-700 text-white px-6 py-3 flex items-center justify-between shadow-md">
      <div className="text-3xl font-bold">
        <Link to="/" className="hover:underline">
          Contilisto
        </Link>
      </div>

      {!loading && (
        <div className="space-x-4 text-base">
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
    </nav>
  );
}
// components/NavBar.tsx
import { Link, useLocation } from "react-router-dom";

export default function NavBar() {
  const location = useLocation();
  const isLanding = location.pathname === "/";

  return (
    <nav className="bg-blue-700 text-white px-6 py-3 flex items-center justify-between shadow-md">
      <div className="text-lg font-bold">
        <Link to="/" className="hover:underline">
          Contilisto.io
        </Link>
      </div>

      <div className="space-x-4 text-sm">
        {!isLanding && (
          <Link to="/dashboard" className="hover:underline">
            Home
          </Link>
        )}

        <Link to="/login" className="hover:underline">
          Login
        </Link>

        <Link to="/register" className="hover:underline">
          Register
        </Link>

        <button
          onClick={() => {
            localStorage.removeItem("authToken");
            window.location.href = "/login";
          }}
          className="hover:underline"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
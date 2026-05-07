// src/components/navbar/NavBar.tsx

import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

import {
  BellIcon,
  ChevronDownIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";

interface NavBarProps {
  onMenuClick?: () => void;
}

export default function NavBar({ onMenuClick }: NavBarProps) {
  const navigate = useNavigate();
  const { setEntity, selectedEntity } = useSelectedEntity();
  const { user: appUser } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setEntity(null);
    localStorage.clear();
    sessionStorage.clear();
    await signOut(getAuth());
    navigate("/", { replace: true });
  };

  const displayName =
    user?.displayName || user?.email?.split("@")[0] || "Usuario";

  const email = user?.email || "";

  const subscriptionPlan = appUser?.planKey ?? appUser?.subscription ?? null;

  return (
    <nav className="bg-blue-700 text-white shadow-md">
      <div className="h-14 sm:h-16 px-3 sm:px-6 flex items-center justify-between gap-2">

        {/* LEFT SIDE — hamburger + entity name on mobile */}
        <div className="flex items-center gap-2 min-w-0">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="md:hidden text-white p-1 -ml-1 shrink-0"
              aria-label="Abrir menú"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          {/* Entity name on mobile (hidden on desktop where sidebar shows it) */}
          {selectedEntity && (
            <div className="md:hidden min-w-0">
              <p className="text-xs font-semibold text-white/90 truncate leading-tight">
                {selectedEntity.name}
              </p>
              <p className="text-[10px] text-white/60 truncate leading-tight">
                {selectedEntity.ruc}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT SIDE */}
        {user && (
          <div
            className="relative flex items-center gap-2 sm:gap-4 shrink-0"
            ref={dropdownRef}
          >

            {/* Notification Icon — hidden on very small screens */}
            <BellIcon className="hidden sm:block w-6 h-6 text-white/80 hover:text-white cursor-pointer" />

            {/* Subscription Badge — hidden on mobile */}
            {subscriptionPlan && (
              <span className="hidden sm:inline text-xs px-2 py-1 rounded-full font-semibold bg-green-500 capitalize">
                {subscriptionPlan}
              </span>
            )}

            {/* Avatar + Name */}
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 sm:gap-2"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white text-blue-700 rounded-full flex items-center justify-center font-bold text-sm">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline font-medium text-sm">
                {displayName}
              </span>
              <ChevronDownIcon className="w-4 h-4" />
            </button>

            {/* USER DROPDOWN */}
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute right-0 top-14 w-64 bg-white text-gray-700 rounded-xl shadow-xl overflow-hidden z-50"
                >
                  {/* User header */}
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <div className="font-semibold">{displayName}</div>
                    <div className="text-sm text-gray-500">{email}</div>
                  </div>

                  <button
                    onClick={() => navigate("/profile")}
                    className="flex items-center gap-2 w-full px-4 py-2 hover:bg-gray-100"
                  >
                    <UserCircleIcon className="w-5 h-5" />
                    Mi Perfil
                  </button>

                  <button
                    onClick={() => navigate("/configuracion")}
                    className="flex items-center gap-2 w-full px-4 py-2 hover:bg-gray-100"
                  >
                    <Cog6ToothIcon className="w-5 h-5" />
                    Configuración
                  </button>

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-4 py-2 text-red-600 hover:bg-gray-100"
                  >
                    <ArrowRightOnRectangleIcon className="w-5 h-5" />
                    Cerrar sesión
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </nav>
  );
}
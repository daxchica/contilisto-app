// src/components/navbar/NavBar.tsx

import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth";
import { useSelectedEntity } from "@/context/SelectedEntityContext";
import { motion, AnimatePresence } from "framer-motion";

import {
  BellIcon,
  ChevronDownIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";

interface NavBarProps {
  onMenuClick?: () => void;
}

export default function NavBar({ onMenuClick }: NavBarProps) {
  const navigate = useNavigate();
  const { selectedEntity } = useSelectedEntity();

  const [user, setUser] = useState<User | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [companyDropdown, setCompanyDropdown] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // 🔐 Auth listener
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
        setCompanyDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut(getAuth());
    navigate("/", { replace: true });
  };

  const displayName =
    user?.displayName || user?.email?.split("@")[0] || "Usuario";

  const email = user?.email || "";

  // 👇 Temporary subscription logic (replace with real plan later)
  const subscriptionPlan = "Pro"; // or "Free"

  return (
    <nav className="bg-blue-700 text-white shadow-md">
      <div className="h-16 px-6 flex items-center justify-between">

        {/* LEFT SIDE */}
        <div className="flex items-center gap-4">

          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="md:hidden text-white text-xl"
            >
              ☰
            </button>
          )}

          {/* Company Switcher */}
          {selectedEntity && (
            <div className="relative">
              <button
                onClick={() => setCompanyDropdown(!companyDropdown)}
                className="flex items-center gap-2 font-semibold hover:text-white/80"
              >
                <BuildingOffice2Icon className="w-5 h-5" />
                {selectedEntity.name}
                <ChevronDownIcon className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {companyDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute left-0 mt-2 w-56 bg-white text-gray-700 rounded-lg shadow-xl overflow-hidden z-50"
                  >
                    <button
                      onClick={() => navigate("/empresas")}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                    >
                      Cambiar Empresa
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* RIGHT SIDE */}
        {user && (
          <div
            className="relative flex items-center gap-5"
            ref={dropdownRef}
          >

            {/* Notification Icon */}
            <BellIcon className="w-6 h-6 text-white/80 hover:text-white cursor-pointer" />

            {/* Subscription Badge */}
            <span
              className={`text-xs px-2 py-1 rounded-full font-semibold ${
                subscriptionPlan === "Pro"
                  ? "bg-green-500"
                  : "bg-gray-400"
              }`}
            >
              {subscriptionPlan}
            </span>

            {/* Avatar + Name */}
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2"
            >
              <div className="w-9 h-9 bg-white text-blue-700 rounded-full flex items-center justify-center font-bold">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline font-medium">
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
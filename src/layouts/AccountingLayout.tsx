// src/layouts/AccountingLayout.tsx
import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/sidebar/Sidebar";
import NavBar from "@/components/navbar/NavBar";
import Footer from "@/components/footer/Footer";

export default function AccountingLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Desktop Sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:w-64 md:block z-40">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 bg-[#0A3558] shadow-xl">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-col min-h-screen md:ml-64">
        {/* ✅ NAVBAR (needed for menu + logout) */}
        <NavBar onMenuClick={() => setSidebarOpen(true)} />

        {/* Content */}
        <main className="flex-1 pt-16 px-3 sm:px-4 md:px-6">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
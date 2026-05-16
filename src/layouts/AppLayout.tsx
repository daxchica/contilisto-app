// src/layouts/AppLayout.tsx

import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "@/components/sidebar/Sidebar";
import NavBar from "@/components/navbar/NavBar";
import Footer from "@/components/footer/Footer";
import FeedbackWidget from "@/components/FeedbackWidget";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen flex bg-gray-100">

      {/* Desktop Sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:w-64 md:block z-40">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-[#0b3a5a] shadow-xl">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content wrapper */}
      <div className="flex flex-col flex-1 md:ml-64 min-h-screen min-w-0">

        {/* NAVBAR */}
        <header className="sticky top-0 z-20">
          <NavBar onMenuClick={() => setSidebarOpen(true)} />
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 pt-4 pb-8 px-3 sm:px-4 md:px-6 lg:px-8 min-w-0">
          <Outlet />
        </main>

        {/* FOOTER */}
        <Footer />
      </div>

      {/* Floating feedback widget — visible on all pages */}
      <FeedbackWidget />
    </div>
  );
}
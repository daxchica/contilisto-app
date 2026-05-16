// src/layouts/AccountingLayout.tsx
import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/sidebar/Sidebar";
import NavBar from "@/components/navbar/NavBar";
import Footer from "@/components/footer/Footer";
import FeedbackWidget from "@/components/FeedbackWidget";

export default function AccountingLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

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
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-[#0A3558] shadow-xl">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-col min-h-screen md:ml-64 min-w-0">
        {/* Sticky navbar */}
        <header className="sticky top-0 z-20">
          <NavBar onMenuClick={() => setSidebarOpen(true)} />
        </header>

        {/* Content — no pt-16 needed; sticky header handles the offset */}
        <main className="flex-1 pt-4 pb-8 px-3 sm:px-4 md:px-6 min-w-0">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>

        <Footer />
      </div>

      {/* Floating feedback widget */}
      <FeedbackWidget />
    </div>
  );
}
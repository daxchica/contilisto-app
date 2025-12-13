// src/layouts/LedgerLayout.tsx
import React, { ReactNode } from "react";
import Sidebar from "@/components/sidebar/Sidebar";
import Navbar from "@/components/navbar/NavBar";
import Footer from "@/components/footer/Footer";

interface Props {
  children: ReactNode;
}

export default function LedgerLayout({ children }: Props) {
  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* SIDEBAR ALWAYS */}
      <Sidebar />

      <div className="flex flex-col flex-1">
        {/* NAVBAR ONLY HERE */}
        <Navbar />

        {/* CONTENT */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>

        {/* FOOTER ALWAYS */}
        <Footer />
      </div>
    </div>
  );
}
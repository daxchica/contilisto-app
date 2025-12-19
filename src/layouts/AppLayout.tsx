// src/layouts/AppLayout.tsx
import React, { ReactNode } from "react";
import Sidebar from "@/components/sidebar/Sidebar";
import Footer from "@/components/footer/Footer";

interface Props {
  children: ReactNode;
}

export default function AppLayout({ children }: Props) {
  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* SIDEBAR ALWAYS */}
      <Sidebar />

      {/* MAIN AREA */}
      <div className="flex flex-col flex-1 ml-64">
        {/* PAGE CONTENT */}
        <main className="flex-1 px-4 overflow-x-auto">
          <div className="w-full">
          {children}
          </div>
        </main>

        {/* FOOTER ALWAYS */}
        <Footer />
      </div>
    </div>
  );
}
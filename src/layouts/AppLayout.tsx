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
      <div className="flex flex-col flex-1 pl-[270px] overflow-hidden">
        {/* SCROLLABLE CONTENT */}

        {/* Page content */}

        <main className="flex-1 p-6 overflow-auto flex justify-center">
          <div className="w-full max-w-6x1">
          {children}
          </div>
        </main>

        {/* FOOTER ALWAYS */}
        <Footer />
      </div>
    </div>
  );
}
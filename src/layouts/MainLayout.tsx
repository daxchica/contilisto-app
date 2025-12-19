// src/layouts/MainLayout.tsx
import React, { ReactNode } from "react";
import Sidebar from "@/components/sidebar/Sidebar";

interface Props {
  children: ReactNode;
}

export default function MainLayout({ children }: Props) {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <div className="flex-1 flex flex-col ml-64">

        {/* Padding para que el contenido no quede debajo del navbar */}
        <main className="p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

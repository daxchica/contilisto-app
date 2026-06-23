// src/App.tsx
import React from "react";
import AppRoutes from "./routes";
import { usePixelPageView } from "@/hooks/usePixelPageView";

export default function App() {
  usePixelPageView();
  return <AppRoutes />;
}

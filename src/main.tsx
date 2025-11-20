// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { SelectedEntityProvider } from "./context/SelectedEntityContext";

import AppRoutes from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <SelectedEntityProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </SelectedEntityProvider>
    </AuthProvider>
  </React.StrictMode>
);
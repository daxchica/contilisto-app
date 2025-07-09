import React from "react";
import ReactDOM from "react-dom/client";
import { StrictMode } from "react";
import { AuthProvider } from "./context/AuthContext.tsx";
import App from "./App";
import "./index.css";


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
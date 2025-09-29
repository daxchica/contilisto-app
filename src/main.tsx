// ./src/main.tsx

import React from "react";
import ReactDOM from "react-dom/client";
import { StrictMode } from "react";
import { AuthProvider } from "./context/AuthContext.js";
import "./index.css";
import { EntityProvider } from "./context/EntityContext.js";
import App from './App';
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs"
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <EntityProvider>
      <App />
      </EntityProvider>
    </AuthProvider>
  </React.StrictMode>
);
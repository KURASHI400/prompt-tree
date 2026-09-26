import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { AuthGate } from "./AuthGate";
import App from "./App";
import { PwaStatus } from "./PwaStatus";
import { APP_NAME } from "./config";
import "./style.css";
document.title = APP_NAME;
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <PwaStatus />
      <AuthGate>
        <App />
      </AuthGate>
    </HashRouter>
  </React.StrictMode>,
);

import React from "react";
import { createRoot } from "react-dom/client";
import "../styles/default.css";
import "../styles/about.css";
import "../styles/admin.css";
import "../styles/auth.css";
import "../styles/budgeting.css";
import "../styles/careers.css";
import "../styles/home.css";
import "../styles/index.css";
import "../styles/legal.css";
import "../styles/profile.css";
import "../styles/records.css";
import "../styles/recurring.css";
import "../styles/reports.css";
import "../styles/rules.css";
import "../styles/settings.css";
import "../styles/upload.css";
import "../styles/team.css";
import "../scripts/default.js";
import App from "./App.jsx";

window.__WALLETLENS_REACT_SPA__ = true;

const container = document.getElementById("root");
if (!container) {
  throw new Error("Missing #root mount node.");
}

createRoot(container).render(<App />);

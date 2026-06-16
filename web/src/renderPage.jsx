import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

export function renderPage(Page) {
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Missing #root mount node.");
  }

  flushSync(() => {
    createRoot(container).render(
      <React.StrictMode>
        <Page />
      </React.StrictMode>
    );
  });

  const year = document.getElementById("year");
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  window.setTimeout(() => {
    document.dispatchEvent(new CustomEvent("walletlens:template-ready"));
  }, 0);
}

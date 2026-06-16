import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

function TemplatePage({ html }) {
  return <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function renderTemplatePage(html) {
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Missing #root mount node.");
  }

  flushSync(() => {
    createRoot(container).render(
      <React.StrictMode>
        <TemplatePage html={html} />
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

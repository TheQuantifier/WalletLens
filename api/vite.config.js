import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const webRoot = resolve(process.cwd(), "web");

export default defineConfig({
  root: webRoot,
  base: "/",
  clearScreen: false,
  server: { host: "127.0.0.1", port: 5173 },
  preview: { host: "127.0.0.1", port: 4173 },
  plugins: [react()],
  build: {
    outDir: resolve(process.cwd(), "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: { index: resolve(webRoot, "index.html") },
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const webRoot = resolve(process.cwd(), "web");

export default defineConfig({
  root: webRoot,
  base: "/",
  clearScreen: false,
  plugins: [react()],
  build: {
    outDir: resolve(process.cwd(), "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(webRoot, "index.html"),
      },
    },
  },
});

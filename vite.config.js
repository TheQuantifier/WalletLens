import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

const webRoot = resolve(process.cwd(), "web");

const htmlInputs = Object.fromEntries(
  readdirSync(webRoot)
    .filter((name) => name.endsWith(".html"))
    .map((name) => [name.replace(/\.html$/i, ""), resolve(webRoot, name)])
);

export default defineConfig({
  root: webRoot,
  base: "./",
  plugins: [react()],
  build: {
    outDir: resolve(process.cwd(), "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: htmlInputs,
    },
  },
});

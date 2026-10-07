import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// The site is served from a subpath on GitHub Pages (/<repo>/). The base is
// overridden by the deploy workflow via VITE_BASE; defaults to "/" for local dev.
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@engine": resolve(__dirname, "../src/engine"),
      "@shared": resolve(__dirname, "../src/shared"),
    },
  },
  build: {
    target: "es2021",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        web: resolve(__dirname, "web.html"),
      },
    },
  },
});

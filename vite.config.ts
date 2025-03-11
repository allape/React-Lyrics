import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: "/React-Lyrics",
  build: {
    outDir: "docs",
  },
  server: {
    host: "0.0.0.0",
  },
});

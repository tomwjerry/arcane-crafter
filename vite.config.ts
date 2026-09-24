import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const port = Number(process.env.PORT || 5173);

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port,
    strictPort: false,
    hmr: false,
  },
  preview: {
    host: "0.0.0.0",
    port,
    strictPort: false,
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 3000,
  },
});

import preact from "@preact/preset-vite";
import { defineConfig } from "vite-plus";

const API_TARGET = process.env.SPRUE_API_URL ?? "http://127.0.0.1:7420";

export default defineConfig({
  plugins: [preact()],
  publicDir: "../../assets",
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: API_TARGET },
      "/mcp": { target: API_TARGET },
    },
  },
  build: {
    target: "es2023",
  },
});

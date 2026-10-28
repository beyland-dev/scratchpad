import preact from "@preact/preset-vite";
import { defineConfig } from "vite-plus";

export default defineConfig(({ command }) => ({
  // Relative asset URLs: the export can be hosted from any sub-path.
  base: "./",
  plugins: [preact()],
  // The sample review in dev/ is served in development only; builds never include it.
  publicDir: command === "serve" ? "dev" : false,
  server: {
    port: 5180,
  },
  build: {
    target: "es2023",
    outDir: "dist",
  },
}));

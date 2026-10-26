import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    dts: {
      generator: "tsgo",
    },
  },
  test: {
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});

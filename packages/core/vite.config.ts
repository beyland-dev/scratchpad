import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/family.ts"],
    dts: {
      generator: "tsgo",
    },
  },
});

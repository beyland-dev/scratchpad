import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/main.ts"],
    deps: {
      alwaysBundle: [
        "@beyland/sprue-capture",
        "@beyland/sprue-core",
        "@beyland/sprue-mcp",
        "@beyland/sprue-server",
      ],
      onlyBundle: false,
      neverBundle: true,
    },
  },
});

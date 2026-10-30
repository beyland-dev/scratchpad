import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    // main: the Electron app. cli: the bundled `sp` command (run by resources/bin/sp).
    entry: { main: "src/main.ts", cli: "../../packages/cli/src/bin.ts" },
    // An app, not a library: no type declarations.
    dts: false,
    deps: {
      alwaysBundle: [
        "@beyland/sprue",
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

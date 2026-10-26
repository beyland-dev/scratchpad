// Creates the gitignored ./playground workspace used by `pnpm dev`, if missing.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initWorkspace } from "@design-tool/core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../playground");
if (!existsSync(path.join(root, ".design", "workspace.json"))) {
  await initWorkspace(root, { name: "Playground" });
  console.log(`Created dev workspace at ${root}`);
}

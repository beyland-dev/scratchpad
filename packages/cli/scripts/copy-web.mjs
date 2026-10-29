import { access, cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cliRoot = fileURLToPath(new URL("..", import.meta.url));
const webDist = path.resolve(cliRoot, "../../apps/web/dist");
const target = path.join(cliRoot, "dist/web");

await access(path.join(webDist, "index.html"));
await rm(target, { recursive: true, force: true });
await cp(webDist, target, { recursive: true });

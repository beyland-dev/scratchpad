import { access, cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = fileURLToPath(new URL("..", import.meta.url));
const webDist = path.resolve(desktopRoot, "../web/dist");
const target = path.join(desktopRoot, "dist/web");

await access(path.join(webDist, "index.html"));
await rm(target, { recursive: true, force: true });
await cp(webDist, target, { recursive: true });

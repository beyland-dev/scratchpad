import { access, cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const coreRoot = fileURLToPath(new URL("..", import.meta.url));
const reviewDist = path.resolve(coreRoot, "../../apps/review/dist");
const target = path.join(coreRoot, "dist/review");

await access(path.join(reviewDist, "index.html"));
await rm(target, { recursive: true, force: true });
await cp(reviewDist, target, { recursive: true });
